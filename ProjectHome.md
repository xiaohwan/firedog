# Sorry Firedog will NOT work on Firefox versions > 3.6 and it needs Jetpack prototype support #
# I didn't have chance to continue my work on this project. I think there are some alternative tools out there already. I will do some research and then share with you. #

# Updated! #
[Download Firedog 0.1.3](http://code.google.com/p/firedog/downloads/detail?name=firedog-0.1.3.xpi)

Firedog is updated with a critical issue that caused number of objects doubled fixed. It makes profiling on large application possible.

# About Firedog #
Firedog is a firebug extension for helping debug complicated web applications. Firedog works with APIs provided by [Jetpack Prototype](https://jetpack.mozillalabs.com/prototype.html) to give developer more abilities on JavaScript code.

# Current Status #
Two tools are "available" currently. Both them are not prefect, even not user friendly. They are really in experimental stage.

## Memory Profiler ##
Developer can take snapshots for objects in the browser runtime on any status of an application. Objects information are organized and displayed by reference relationships. By comparing between snapshots we will know increased objects during an operation. Also you can compare snapshots taken at different time but on the same application status (from end user view point), then those memory objects that are not well reclaimed (**probably**) will be list.

## Object observer ##
Once firedog extension is installed and running, several methods are injects to the client window context in a namespace "firedog".

Firedog.observe is used for observing updating and deleting actions on an object. Once an object is observed, custom handlers (or say hook) are invoked when a property of the object is getting updated or deleted.

` Firedog.observe(objTarget, funcSetter(wrappedObject), strProperty, objHandlers) `

Two custom handlers are supported right now. They are:

`onSet(originalValue, newValue, callStack)`

and

`onDelete(originalValue, callStack)`

"objHandlers" would look like

` {onSet: function(ov, nv, cs){/*...*/}, onDelete: function(ov, cs}{/*...*/}} `

# Roadmap #
## 0.2 ##
  * Provide UI for "interest types". Profiler gets properties info for those objects in those types. Now it's hard coded in profiler.js

  * **Add "search mode" in while profiling start with a group of certain objects and follows the reference. (Now all objects get profiled and then analyse references).**

## 0.3 ##
  * Make name decorator customizable.
## Long Term ##
[Jetpack Prototype](https://jetpack.mozillalabs.com/prototype.html) had been retired so one of my tasks is to update firedog get rid of [Jetpack Prototype](https://jetpack.mozillalabs.com/prototype.html). (Also may take help from other projects like Jetpack SDK, not sure about that.)

# Known Issues #
**(solved in 0.1.1) Objects in closure and html expando aren't in snapshot in v0.1**

**(solved in 0.0.1) Get exception when profile on large application**

# Demo #
Not available yet.