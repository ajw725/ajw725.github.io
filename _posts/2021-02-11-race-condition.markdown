---
layout: post
title:  "I Remember My First Race Condition"
date:   2021-02-11 08:00:00 -0700
tags: ruby rails concurrency
published: true
comments: true
---

Part of what I aim to do in this space is to demystify some of the concepts in software development that I used to find intimidating. Take race conditions, for example.

{% include image.html url="/assets/images/race-conditions/bolt.png" width="600" alt="Usain Bolt" description="I warned you about the jokes. (Photo: Cameron Spencer - Getty Images)" %}

I used to hear people talk about race conditions (and thread safety, concurrency, etc.) and think they were this magical thing I'd never really understand because I don't have a computer science degree. I distinctly remember the moment I began to suspect I might be wrong, though. I was texting a friend (who is also a software engineer) and, if I recall correctly, we sent each other similar messages at pretty much the same time, and he said, "ha! race condition."

This is also why software engineers only hang out with other software engineers.

Anyway, I still wasn't sure I really understood what it meant - or at least what the implications were in real life - until I encountered one of my own. This is the story of that fateful day.

{% include image.html url="/assets/images/race-conditions/minnow.png" width="600" alt="The S.S. Minnow" description="Ok, maybe not *this* fateful day." %}

### The bug

The problem occurred in a Rails app that did a lot of different things, but the thing in question was some code related to generating documents from templates. There was a controller endpoint that accepted a set of instructions containing references to one or more templates, and each template in the instructions would launch its own Sidekiq worker for background processing. Some metadata about the results of the operation would be stored in the database and could be reviewed by the user.

The bug we noticed was that, if multiple templates were included in the request, only the metadata for one of them would be saved.

### The "fix"

One of the other developers was able to reproduce the problem, so he made a change, verified that the code worked as intended, and we were good to go!

<blockquote>Narrator: They were not good to go.</blockquote>

There's a narrator now?

{% include image.html url="/assets/images/race-conditions/sam_elliott.jpg" alt="Sam Elliott" description="Sometimes you eat the bear, and sometimes he eats you." %}

Cool. Well...yeah, what he said. Anyway, what followed was classic software development:

1. A new bug appeared a few days later
1. I determined that the new bug was actually a result of the aforementioned attempted fix
1. I opened a pull request to fix this new bug
1. The first developer suggested that I re-test the original bug after my fix-for-the-fix
1. I was able to reproduce the original bug
1. I reverted my fix-for-the-fix and was *still* able to reproduce the original bug, which meant that the first fix hadn't actually done anything (aside from introducing a new bug)

So now we're back to square one, and I set about investigating the original bug myself.

### The real problem

Let me explain a little more about what was going on in these Sidekiq workers. I mentioned that we were storing some metadata about the results of the operation in each worker. Well, we were storing that metadata on a single parent record for all of the workers that ran from a particular request. The code in the worker would retrieve the metadata from the parent record, add its own new metadata, and save the whole thing (and at this point, those of you who know anything about concurrency are going, "well, duh," but bear with me).

The first thing I did was just to run the code a few times and watch the logs. I noticed that sometimes, the logs looked like this:

```
[worker1] starting...
[worker1] done
[worker2] starting...
[worker2] done
```

And in those cases, everything worked great. But sometimes, they looked like this:

```
[worker1] starting...
[worker2] starting...
[worker1] done
[worker2] done
```

And this was bad news bears.

{% include image.html url="/assets/images/race-conditions/bear.jpg" alt="Bear" description="I'm not sure where all the bear references came from." %}

I was starting to get the idea, but I put in a debug breakpoint and did some poking around in each worker, and sure enough, neither worker was seeing the changes made by the other one; each one just saw the pre-request state of the data and was adding its own data to that, then saving. To illustrate, say the data starts as an empty hash:

```ruby
parent.metadata
# => {}
```

What's supposed to happen is that worker 1 does something like this:

```ruby
parent.metadata
# => {}
new_metadata = { worker1: 'did thing 1' }
parent.metadata.merge!(new_metadata)
parent.save!
parent.reload.metadata
# => { worker1: 'did thing 1' }
```

Then worker 2 does something like this:

```ruby
parent.metadata
# => { worker1: 'did thing 1' }
new_metadata = { worker2: 'did thing 2' }
parent.metadata.merge!(new_metadata)
parent.save!
parent.reload.metadata
# => { worker1: 'did thing 1', worker2: 'did thing 2' }
```

But what I was actually seeing in worker 2 (some of the time) was this:

```ruby
parent.metadata
# => {}
new_metadata = { worker2: 'did thing 2' }
parent.metadata.merge!(new_metadata)
parent.save!
parent.reload.metadata
# => { worker2: 'did thing 2' }
```

So if one worker finished before the other started, like the first log pattern above, then everything worked fine, because its changes would already be in the database before the second worker retrieved and updated them. But if the timing was just right (or wrong), the second worker would retrieve the empty metadata from the parent record before the first worker saved its results. So the process would go like this:

1. First worker retrieves empty parent metadata
1. Second worker retrieves empty parent metadata
1. First worker saves metadata with its results
1. Second worker saves metadata with its results, *overwriting* the results of the first worker

The order would change sometimes, and whichever worker ran last would win.

### The real fix

The fix was actually pretty simple. I just requested a lock on the parent record in the worker:

```ruby
parent.with_lock do
  new_metadata = { worker1: 'did thing 1' }
  parent.metadata.merge!(new_metadata)
  parent.save!
end
```

This way, the first worker obtains a pessimistic lock on the record and has exclusive access to read the old metadata and update it before the second worker is even allowed to read the old value.

### Conclusions

I'm far from an expert on concurrency, and as race conditions go, this one was relatively straightforward. I think it's a good example of this type of problem, though. One of the biggest red flags is seeing behavior that is hard to reproduce and seems nondeterministic, especially if it involves multiple asynchronous processes or threads. This of course makes reproducing, debugging, and fixing the problem particularly challenging. My colleague made an irrelevant change but thought he had fixed the bug because he could no longer reproduce it afterward, and I'm pretty sure I'd have thought exactly the same thing.

The moral of the story, my friends, is that you, too, can (and will) deal with race conditions.

{% include image.html url="/assets/images/race-conditions/smokey.jpg" alt="Smokey the Bear" description="Might as well stick to the theme at this point." %}