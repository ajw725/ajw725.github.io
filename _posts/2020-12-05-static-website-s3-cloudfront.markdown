---
layout: post
title:  "Deploying a Single-Page App with S3 and Cloudfront"
date:   2020-12-05 08:00:00 -0700
tags: aws tutorials
published: false
---

One of my hopes for this blog is to share what I've learned with the world, so that developers from all over can come together and learn from my wisdom.

Ok, ok...really it's just to document stuff so I can remember how the heck I did something difficult if I ever need to do it again. Seriously, though - I can't count how many times I've had to piece together information from six different blog posts and documentation sites to get a clear picture of the one workflow I'm trying to figure out. Once I do understand the full picture, I often wish there had been an explanation written in the way *I* would have explained it, so this blog is me deciding to write some of those explanations.

I figured I'd start with something I just did recently, which is...deploying a React application to S3 and setting up a Cloudfront distribution for it! Yay! The one thing you've always wished you knew how to do!

Step one: have a React application.
