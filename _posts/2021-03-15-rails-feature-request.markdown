---
layout: post
title:  "The Time I Almost Contributed to Rails"
date:   2021-03-15 08:00:00 -0700
tags: ruby rails open-source security cybersecurity
published: true
comments: true
---

If you look through all of the commits in the [Rails repository](https://github.com/rails/rails), squinting just right, as the sun sets...you still won't see my name. But it was almost a different story. This is a tale of a contribution that never was, but it's also a tale of all the things I learned along the way - about cybersecurity, Rails, middleware, and more. It's going to be rather long, because I'll go into detail on the issue that led to my desire for a feature addition in Rails, but I thought it was an interesting journey, and I hope you agree.

I have to admit that I've always been a little jealous of and impressed by people who contributed to popular open-source projects. How cool would it be to implement a feature somewhere that hundreds, or thousands, or maybe even millions of other developers would use on a daily basis? And when they went to look at the project, they'd see your name in the commits or the changelog? To me, there's a special appeal to building things for other developers; they're an audience that I know will understand and appreciate what I've built on a deeper level. I guess this is why I ended up on the platform team at my current company, and why I enjoy sharing shortcuts and scripts and automating pipelines and deployments. It's a great feeling when you find a tool someone made that solves the exact problem you have or makes you more efficient, and it's even better to be able to provide that for others.

But...how do these people get involved in these projects? Where do they find the time? When I'm doing coding-related things outside of work, it's usually more along the lines of taking Udemy courses, reading blog posts, and other forms of learning. Do people just decide one day that they're going to contribute to a project and start browsing through open issues on Github? Are they just brilliant and creative and full of ideas about how to improve all the tools they use? Is this just something that happens as you get further into your career and gain experience? I'm still not entirely sure I know the answer, but I can tell you how I found myself in that position.

Let's begin:

{% include image.html url="/assets/images/rails-contrib/snoopy.jpg" width="600" alt="Snoopy" description="Schulz" %}

### A brief flashback

Actually, before I get to the story I actually wanted to tell here, let me rewind a few years to my first (and admittedly only) open-source contribution. I was setting up <a href="https://github.com/activeadmin/activeadmin" target="_blank">ActiveAdmin</a>, a back-end administration framework and user interface, for a Rails project. At this point, I had a little over two years of experience with Ruby and about a year and a half with Rails, so I still felt pretty new to the whole thing. I knew what I wanted to do, though - just set a custom title for a particular section of a page - and I could tell it wasn't possible with this tool. I did some searching, found a <a href="https://github.com/activeadmin/activeadmin/issues/660" target="_blank">Github issue</a>, and added my voice to a string of comments going back more than five years. To my surprise, one of the maintainers responded, pointed out the exact piece of code that would have to change, and said he'd be happy to take a pull request. So, I figured...why not give it a shot?

{% include image.html url="/assets/images/rails-contrib/jump_in.gif" width="400" alt="Here we go" %}

It turned out that the <a href="https://github.com/activeadmin/activeadmin/pull/4940" target="_blank">actual change</a> was very simple. It took me much longer to figure out how to add tests with Cucumber and Capybara, and it probably took more time for the maintainers to guide me through the process - fixing code style, squashing commits, etc. - than it would have taken them to just fix the thing themselves. But I'm glad they didn't just fix it themselves, because it was a good learning experience for me, and it took away a bit of the magic behind the curtain. These tools I was using were just code, not really any different from the code I was writing in my own projects, and they also had room for improvement.

### The problem

Ok, back to the (almost) present. My company had hired a firm to run a penetration test on one of our products, and one of the things they reported was that our application was vulnerable to host header injection (we've fixed it, so no, you can't hack us). What does this mean? Well, as an oversimplified example, let's say I have a Rails application that does something like this (which is not something I'd actually do):

```ruby
# app/controllers/home_controller.rb
def index
  @host = request.headers['HTTP_HOST']
end
```

```erb
<!-- app/views/home/index.html.erb -->

<img src="<%= @host %>/public/my_picture.jpg" />
```

What I'm trying to do here is show you an image hosted on my own site, under the same domain as the page you're viewing. The host header should be the url of the site you're on. But what if (bear with me) you decided to hack yourself, and you made another request where you set the `Host` header to `http://evil.com`? My code would just accept that value and serve an image from `evil.com` instead of from my own site. Doing this to another user on a different computer is obviously a little more difficult, since you can't just set an arbitrary header on a request they make, but it is possible, e.g. through cache poisoning. There are lots of sources - such as <a href="https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection" target="_blank">OWASP</a> - that understand and can explain this better than I can, but essentially, what happens is something like this:

1. You submit a request to my website at `www.example.com` with the `Host` header set to `www.evil.com`.
1. My naive website trusts your host header and redirects you to `www.evil.com`.
1. Some part of the infrastructure hosting my website - perhaps a caching proxy or CDN - caches that 302 redirect.
1. Someone else tries to visit my site, which responds from the cache and redirects the user to `www.evil.com`.

And what happens next is something like this:

{% include image.html url="/assets/images/rails-contrib/strongbad.png" width="400" alt="Did you download 400000 viruses?" description="You have now downloaded 400,000 viruses." %}

The image tag example above is pretty contrived, and I knew we weren't doing anything like this in our code. I searched for any references to the `Host` and `X-Forwarded-Host` headers and didn't find any, and I started to get a little confused and frustrated at the penetration testers. But I did some Googling and discovered that Rails actually <a href="https://github.com/rails/rails/issues/29893" target="_blank">does more or less the same thing as my example</a> internally in its url-generation helper methods. So if my code instead just looked like this:

```erb
<!-- app/views/home/index.html.erb -->

<%= image_tag 'my_picture.jpg' %>
```

We actually might still be vulnerable to the same attack!

### Putting on my hacker hat

Now that I was pretty sure I understood the reported vulnerability, it was time to try to reproduce it in our own code, just to make sure I understood it correctly. Instead of using our actual application, though, I set up a little Rails app to test with. You can find it <a href="https://github.com/ajw725/rails_host_headers" target="_blank">here</a>. It has a home page with a simple link - using Rails's URL helpers - to a second page. Under normal circumstances, if you click the link, you'll be redirected to the second page.

This is where it gets fun. I'd normally use a proxy like <a href="https://www.charlesproxy.com/" target="_blank">Charles</a> for the next step, but...actually, the problem is that I recently got a new Mac, and I can't get the Charles Mac proxy working right now. So we're going with `curl`. Let's try a normal request:

```
andrewweinstein::~ % curl http://localhost:3000/
<!DOCTYPE html>
<html>
  <head><%-- stuff --></head>
  <body>
    <h2>Home</h2>
    <a href="http://localhost:3000/hackable">click me</a>
  </body>
</html>
```

Notice that the URL of the link has its domain set to localhost, as it should be. Now let's try again while setting the host header:

```
andrewweinstein::~ % curl -H "Host: www.google.com" http://localhost:3000/
<!DOCTYPE html>
<html>
  <head><!-- stuff --></head>
  <body>
    <h2>Home</h2>
    <a href="http://www.google.com/hackable">click me</a>
  </body>
</html>
```

Uh oh! Now the link is taking us to Google! That's not good (but at least it's not Bing). Let's try one more time using the `X-Forwarded-Host` header:

```
andrewweinstein::~ % curl -H "X-Forwarded-Host: www.google.com" http://localhost:3000/
<!DOCTYPE html>
<html>
  <head><!-- stuff --></head>
  <body>
    <h2>Home</h2>
    <a href="http://www.google.com/hackable">click me</a>
  </body>
</html>
```

Same result. We now know for sure that Rails will use *either* of those two host headers, preferring `X-Forwarded-Host`, in its URL helpers. In order to fix this vulnerability, we either have to get a change into Rails itself or find some way to monkey patch it in our own application.

### The fix

Before we implement a fix, let's think about what we're actually trying to do. We can't modify all of the Rails code to stop using the host headers entirely; I hate to disappoint you, but that's not the feature request I made. However, we do know the domains (for a few different environments) at which our site will be hosted, and only those domains should be considered valid hosts. What we want, really, is just to compare the host header against a list of allowed values and block or redirect the request if we see anything else.

Your first thought might be, as mine was, that we could do this in some kind of before action in `ApplicationController`, but we need it to happen before the request gets to any kind of controller - either in our own code or in the Rails controllers from which ours inherit - at all, which means we need to implement this as a piece of middleware. If you're not familiar with middleware, it's basically just code that runs in between the web server/OS and the rest of your application code. You can have as many pieces of middleware as you want, and they'll just run one after another on each request until the stack is empty, at which point the request gets passed along to your application.

So we need some code that we can run as middleware that will check and sanitize the host header. Well, perhaps not surprisingly, we're not the first people to want this. In fact, the gentleman who opened the Rails issue linked above was kind enough to <a href="https://github.com/pusher/rack-headers_filter/blob/master/lib/rack/headers_filter.rb" target="_blank">implement it himself</a>. Using his example as a reference, we might end up with something like this:

```ruby
# lib/rack/headers_filter.rb

module Rack
  class HeadersFilter
    ALLOWED_HOSTS = %w[localhost]

    def initialize(app)
      @app = app
    end

    def call(env)
      env.delete('HTTP_X_FORWARDED_HOST')
      return redirect unless allowed_host?(env)

      @app.call(env)
    end

    private

    def allowed_host?(env)
      domain_with_port = ActionDispatch::Http::URL.extract_domain env['HTTP_HOST'], 1
      domain = domain_with_port.gsub(/:\d+$/, '')
      ALLOWED_HOSTS.include?(domain)
    end

    def redirect
      [
        301,
        { 'Location' => 'https://mysite.com', 'Content-Type' => 'text/html' },
        ['Moved Permanently']
      ]
    end
  end
end
```

I won't go into the structure of the middleware itself too much, because you can look that up, but the important part is that we implement a `#call` method. Each piece of middleware in the chain gets initialized and `call`ed with the request context. To allow a request to proceed, we invoke the next piece of middleware like `@app.call(env)`. To stop the request, we simply return a response or raise an exception. Note that we have to work with plain old Rack - the web server interface on which Rails and several other frameworks are built - here rather than Rails itself, because the middleware runs before the application context is loaded, so a redirect is accomplished just by returning the status, headers, and body to the caller. We also can't use the nice helper methods Rails provides, like `request.host`.

How does our middleware work? When it gets called, it first just strips out the `X-Forwarded-Host` entirely, because it's not really necessary. We then check the value of the `Host` header against a hard-coded list of allowed hosts. If there's a match, we pass along the request to the next piece of middleware, but if there's not, we halt the request and return a hard redirect to our actual domain.

We can add this middleware to the beginning of the middleware chain in our application config file, like so:

```ruby
# config/application.rb

require_relative '../lib/rack/headers_filter'

module HostHeaders
  class Application < Rails::Application
    config.middleware.insert_before 0, Rack::HeadersFilter
  end
end
```

Let's test again. First, with the `Host` header:

```
andrewweinstein::~ % curl -H "Host: www.google.com" http://localhost:3000/
Moved Permanently%
```

Great - we get back a 301!

And now with the `X-Forwarded-Host` header:

```
andrewweinstein::~ % curl -H "X-Forwarded-Host: www.google.com" http://localhost:3000/
<!DOCTYPE html>
<html>
  <head><!-- stuff --></head>
  <body>
    <h2>Home</h2>
    <a href="http://localhost:3000/hackable">click me</a>
  </body>
</html>
```

Even better! We're just stripping out that header entirely and falling back to the regular old `Host` header, which hasn't been modified, so the link retains the correct (safe) domain. Our solution seems to work nicely.

{% include image.html url="/assets/images/rails-contrib/shall_not_pass.jpg" width="400" alt="You shall not pass" description="Begone, hackers." %}

### Deployment, load balancers, and a little snag

I made more or less these same changes in our app and got it all working in my local development environment. I deployed it to our staging environment to test it out, and...it didn't work. And I don't mean my fix didn't work; I mean the entire *application* didn't work, and the site (fortunately just staging) went down completely. What happened?

I took a look at the logs and realized that the application was failing the load balancer health check. A quick infrastructure primer: you don't just want one server running your application in production, because if anything happens to that server, it means your entire site is down. It's better to have at least a couple of identical servers running the same code. You can put them all behind a load balancer, which pretty much does what it sounds: it spreads the incoming traffic across all of your available servers. Let's say I have my app running at `mysite.com` with two application servers and one load balancer. When you make a request to `mysite.com`, it goes to the load balancer, which decides (using one of several possible strategies, which I won't go into here) which of the two servers should receive your request.

What happens if one of the two servers crashes? The load balancer should stop sending traffic to that server, which means it needs to know which servers are healthy at any given time. It usually does this by sending frequent (every few seconds) health check requests to an endpoint in your application that you specify when you set up the load balancer. The health check should be within the application itself - i.e. in Rails as opposed to something like a reverse proxy sitting in front of it - in order to serve as an accurate indicator of whether the application is really working. We often just set up an endpoint at `/healthcheck` with its own route and controller. If the load balancer receives a 200 response, it allows that server to receive traffic, and any other response will be deemed unhealthy (although the healthy response codes are usually configurable).

{% include image.html url="/assets/images/rails-contrib/are_you_ok.jpg" width="400" alt="Are you ok?" description="The load balancer just sends this picture every 5 seconds." %}

Remember how we set up our middleware? It's checking the host header of the incoming request against our list of allowed hosts. When I looked at the server logs in staging, I could see that the host of the load balancer health check request was not the domain name of our application, but rather the actual IP address of the target server. This hadn't occurred to me before, but it makes total sense; the infrastructure isn't supposed to be aware of the application code. The only point at which the domain should matter is in mapping a request to the load balancer, and after that, the load balancer just uses the private IP addresses of the servers to communicate with them.

It seems like our middleware needs some adjustment. Unfortunately, we can't just add the IP addresses of the servers to our list of allowed hosts. We need to be able to spin up new servers and shut down old ones on demand, and if we hard-coded the IP addresses, we'd have to update and redeploy the code every time. Just as the load balancer shouldn't know anything about the application code, so too should the code remain as infrastructure-agnostic as possible. The only remaining option is for us to simply give up and skip our host check entirely on that one specific health check endpoint, which is fine because it's not a request that's initiated by a user or that renders any kind of content.

We can just add one line to our `#allowed_host?` method from before:

```ruby
def allowed_host?(env)
  return true if env['PATH_INFO'].to_s == '/healthcheck'

  domain_with_port = ActionDispatch::Http::URL.extract_domain env['HTTP_HOST'], 1
  domain = domain_with_port.gsub(/:\d+$/, '')
  ALLOWED_HOSTS.include?(domain)
end
```

I made this change, redeployed the code to staging, and it was back up and running. I confirmed the host header injection vulnerability was fixed in staging and then pushed it out to production.

### A different approach in Rails 6

It turns out that, perhaps unsurprisingly, the Rails team understands this problem and <a href="https://github.com/rails/rails/pull/33145" target="_blank">has built most of this functionality into Rails 6</a>. There's a nifty little configuration setting to specify a list of allowed hosts, and a corresponding piece of middleware that serves more or less the same purpose as the one we wrote above. So now, in your `config/application.rb`, you can just do something like:

```ruby
# config/application.rb

module HostHeaders
  class Application < Rails::Application
    config.hosts << 'localhost'
  end
end
```

Great! This eliminates everything else we had to do above. Except...what about the health check thing?

### The feature request

Unfortunately, that part wasn't covered. If we used the new host header authorization in Rails 6, it would block our health check, which means we'd have to go back to our custom implementation. This didn't seem right to me. If Rails now has middleware to check the host header against a list of allowed hosts, shouldn't it also be able to take a list of endpoints for which to skip that host header check? I can't be the only person who would need this, whether for my health check endpoint, some kind of webhook, or something else.

Let's dig into the Rails source code a little and see if we can figure out how that would work.

{% include image.html url="/assets/images/rails-contrib/cheshire_cat.jpg" width="400" alt="Cheshire cat" description="Down the rabbit hole we go!" %}

I created a new Rails 6 project, opened it in RubyMine, and started jumping into the source code. I set `config.hosts` as shown above, then jumped to the `hosts` definition, which turned out to be an `attr_accessor` on `Rails::Application::Configuration`, as defined in the <a href="https://github.com/rails/rails/blob/main/railties/lib/rails/application/configuration.rb" target="_blank">railties gem</a>. It gets set in the constructor like this (lots of stuff cut out here):

```ruby
# railties: lib/rails/application/configuration.rb

module Rails
  class Application
    class Configuration < ::Rails::Engine::Configuration
      attr_accessor :hosts

      def initialize
        # some other stuff
        @hosts = Array(([".localhost", IPAddr.new("0.0.0.0/0"), IPAddr.new("::/0")] if Rails.env.development?))
        # more stuff
      end
    end
  end
end
```

Now let's find where it's used.

I went back to the PR I linked above that implemented the host header checking and saw that it introduced a piece of middleware in the <a href="https://github.com/rails/rails/tree/main/actionpack" target="_blank">actionpack gem</a>. Searching for the name of this class led me back to railties, to `Rails::Application::DefaultMiddlewareStack`. That class had this line:

```ruby
# railties: lib/rails/application/default_middleware_stack.rb

middleware.use ::ActionDispatch::HostAuthorization,
                config.hosts,
                config.action_dispatch.hosts_response_app,
                **config.host_authorization
```

So...if we just added another configuration attribute with a list of allowed paths, we could pass it into the middleware, which could check the incoming request against those paths before verifying the host header. Let's give it a shot. First, the configuration attribute:

```ruby
# railties: lib/rails/application/configuration.rb

module Rails
  class Application
    class Configuration < ::Rails::Engine::Configuration
      attr_accessor :hosts, :host_check_skip_paths

      def initialize
        # some other stuff
        @hosts = Array(([".localhost", IPAddr.new("0.0.0.0/0"), IPAddr.new("::/0")] if Rails.env.development?))
        @host_check_skip_paths = []
        # more stuff
      end
    end
  end
end
```

Then pass it into the middleware:

```ruby
# railties: lib/rails/application/default_middleware_stack.rb

middleware.use ::ActionDispatch::HostAuthorization,
                config.hosts,
                config.host_check_skip_paths,
                config.action_dispatch.hosts_response_app,
                **config.host_authorization
```

And finally, use it:

```ruby
# actionpack: lib/action_dispatch/middleware/host_authorization.rb

def initialize(app, hosts, host_check_skip_paths = [], deprecated_response_app = nil, exclude: nil, response_app: nil)
  @app = app
  @host_check_skip_paths = host_check_skip_paths
  # other stuff
end

private

def authorized?(request)
  return true if @host_check_skip_paths.include?(request.path)

  # otherwise proceed as before
end
```

And our updated application configuration would look like this:

```ruby
# config/application.rb

module HostHeaders
  class Application < Rails::Application
    config.hosts << 'localhost'
    config.host_check_skip_paths << '/healthcheck'
  end
end
```

I monkey-patched my app like this locally and it seemed to work as I intended.

Once I had an idea of how I wanted to implement my new feature, I read the Rails <a href="https://guides.rubyonrails.org/contributing_to_ruby_on_rails.html" target="_blank">contributing guide</a>, which said to submit feature requests to the Rails core mailing list, which <a href="https://discuss.rubyonrails.org/t/feature-proposal-list-of-paths-to-skip-when-checking-host-authorization/76246" target="_blank">I did</a>. I didn't get as much discussion as I had hoped, but the one person who responded seemed to think it was a worthwhile thing to implement, although he did suggest a slightly different implementation, which was fine with me. I waited a bit and, when I didn't get any more feedback, just went ahead and opened a <a href="https://github.com/rails/rails/pull/40328" target="_blank">pull request</a> into Rails.

{% include image.html url="/assets/images/rails-contrib/lightning.jpg" width="400" alt="Lightning" description="Shouldn't there be a thunderclap or something?" %}

I'm going to skip over the part where I had to set up the <a href="https://github.com/rails/rails-dev-box" target="_blank">Rails dev box virtual machine</a> so that I could add and run tests, but I did it and it was an important (and moderately frustrating) part of this process. Tests are important, Rails is pretty huge, and it's very hard to know what you might be breaking if you don't run all the tests, or when someone might break your feature in the future if you haven't added tests for it.

My PR was quiet for a while, but eventually, someone responded. It turned out that, while I hadn't seen it - partly because it had been sitting around for a while and had gone stale - someone else had actually <a href="https://github.com/rails/rails/pull/38829" target="_blank">gotten there first</a>. So that implementation went into Rails, and I faded back into obscurity once more. But at least I'd have the feature I wanted!

Interestingly, the PR that was accepted was closer (although not exactly the same) as the original implementation I proposed to the mailing list, before the person who responded suggested a different approach. More on this below.

### What I learned

You might be wondering why I wrote an entire blog post about the fact that I didn't actually get to contribute to Rails. Actually, I hope you've learned enough along the way that you're not still wondering that, but in case you are, here's what I feel like I got out of this whole adventure.

1. **If you're using software, you're probably capable of contributing to it.** This may not be universally true, but I think it's true in a lot of cases, and it's a good mindset to have. You're using Rails? Cool - you have the ability to look at the source code, figure out what it's doing, and figure out how to change it to do what you want. Don't be afraid to monkey-patch things locally and test them out! A good IDE setup is a huge help when jumping around in the source code like this.
1. **If you use something enough, you'll find areas for improvement.** Don't assume that the tools you're using have been pored over and perfected. I mean, heck, 50 years ago, personal computers didn't even exist. These tools are just other software, just like what you're building, built by other people like you. Whether it's a bug or a feature request, you'll find things you want to change, and (see previous item) you'll probably be able to change them.
1. **People who maintain open-source software want your help.** They might get a little impatient sometimes, e.g. if you don't read the contributing guidelines or search for existing issues before opening a new one. But they want you to help, and most of the time, they'll help you help them. If you want to contribute, don't be afraid to ask them for a little guidance to get you started.
1. **Don't assume other people's approaches are more valid than yours.** I was glad to get some feedback on the Rails core mailing list, and I assumed that anyone who would respond to a request on there probably knew more than I did about how Rails should work. But as it turned out, the PR that the team accepted was closer to my original proposal than to the suggestion I was given in the mailing list. If you've taken the time to use the tool, look at the code, and match your addition to what's already there, don't be afraid to stand behind your approach. That said, if someone *does* make a good suggestion, don't reject it just because it wasn't your idea.
1. **Don't trust host headers.** Or anything else that a user could potentially modify. In fact, users are evil. If possible, just don't let them touch your application at all. It's safest that way. Bonus points if you just avoid computers entirely.

### The end

That got a lot longer than I anticipated. Thanks for reading!
