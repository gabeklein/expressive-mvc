
<h1 align="center">
  Use Stateful
</h1>

<p align="center">
  Easy to use live-state with the magic of react hooks!
</p>
 
<p align="center">
  <a href="https://www.npmjs.com/package/use-stateful"><img alt="NPM" src="https://img.shields.io/npm/v/use-stateful.svg"></a>
  <a href=""><img alt="Build" src="https://shields-staging.herokuapp.com/npm/types/good-timing.svg"></a>
</p>

## Quick Start

<br />

> Install with preferred package manager
```bash
npm install --save use-stateful
```
<br />

> Import and use in your components

```js
import { useStateful } from "use-stateful";
```

<br/>

> Remember to ⭐️ if this helps in your endeavors!

<br/>

## What does it do?

Use stateful is a great alternative to having a bunch of `useState` calls within your components. A single `useStateful` hook can manage pretty much all the simple state in your component with one call.

### Consider the following:

> Here is an example where we have multiple values to track. <br/>
> All the single-use variables can really add up, and they're not always easy to read or infer. 

```jsx
const EmotionalState = () => {
    const [name, setName] = useState("John Doe");
    const [emotion, setEmotion] = useState("meh");
    const [reason, setReason] = useState("reasons.");

    return (
        <div>
            <div onClick = {() => {
                const name = prompt("What is your name?", "John Doe");
                setName(name);
            }}>
                My name is {name}.
            </div>
            <div>
                <span onClick = {() => {
                    setName("sad");
                }}>
                    I am currently {emotion}
                </span>
                <span onClick = {() => {
                    setReason("hooks are still not hipster enough.")
                }}>
                    because {reason}
                </span>
            </div>
        </div>
    )
}
```
> This makes John Doe correspondingly sad, as you can see here.

### How can we do better?

> Use the `useStateful` hook.

```jsx
const HappyTown = () => {
    const $ = useStateful(_ => ({
        name: "John Doe",
        emotion: "whatever",
        reason: "I dunno man. :/"
    }));

    return (
        <div>
            <div onClick = {() => {
                $.name = prompt("What is your name?", "John Doe");
            }}>
                My name is {$.name}.
            </div>
            <div>
                <span onClick = {() => {
                    $.emotion = "super happy"
                }}>
                    I am currently {$.emotion} 
                </span>
                <span onClick = {() => {
                    $.reason = "hooks are cooler than my nitro ice-cold-brew® coffee! 👓"
                }}>
                    because {$.reason}
                </span>
            </div>
        </div>
    )
}
```

> Much better.

### ... and that does work?

Yep. The component updates when any of the declared values change. 👍

<br/>

## So what's going on here?

In a nutshell, `useStateful` grafts ✨*live-state* ✨ onto your initial state and returns that to your component through the hook engine. 

### But what do we mean by ✌️live state ✌️?

Basically it is a new object, inheriting (via prototype) from the one you passed into `useStateful`, with all of its "live values" (enumerable, non-methods) covered over with `setter` & `getter` pairs. It uses the given state object to set initial values and to know what setters are needed for tracking. The hook will then watch for updates to those values, compare them, and if they're different... trigger a render! 🐰🎩

> The hook's function argument, its "*constructor*", will ***only run at mount***, and the returned object will then be bootstrapped into the live state object.

<br/>


## You can add methods too

Similar to `@computed` and `@action` concepts found in [MobX.js](https://github.com/mobxjs/mobx), you can include `get`, `set`, and regular methods amongst your watched values. 

They'll reference your live state and work [generally as you'd expect](https://www.destroyallsoftware.com/talks/wat), with regards to `this` keyword.

**All methods are bound too,** so you can pass them as callbacks or to sub-components, and it'll work just fine.

<br/>

```jsx
const HiBob = () => {
    const $ = useStateful(_ => ({

        ownName: "Bob",
        friendsName: undefined,

        sayHi(){
            const whatsHisFace = this.friendsName;
            if(whatsHisFace){
                alert(`Oh hey ${whatsHisFace}, how's it uh hanging? 🤙`)
                //Bob, do people even say that anymore?
                //This is getting awkward, Abort ABORT
                alert(`👀 Oh, I think I heard my toast finish. Gotta go get that.`)
                return;
            }

            alert(this.standardHello);
            const whoIsThisGuy = prompt("Hey uuuhh...");
            if(whoIsThisGuy){
                //play it cool Bob, play it cool.
                alert(`Oh hey ${whoIsThisGuy}! Long time no see!! 🤝`);
                this.friendsName = whoIsThisGuy;
            }
            else {
                alert(`Heeeey, ...There..? 😓`);
                //you friggin blew it Bob
            }
        },

        get standardHello(){
            return `Hey there, name's ${this.name}.`;
        },

        set friend(name){
            //immediately forget
            this.friendsName = "bro"
        }
        
    }));

    return <div onClick={$.sayHi}>Hi {$.ownName}</div>
}
```

### Some Reserved methods

#### `refresh(): void`
- requests a re-render without requiring a value changed. Helper in computing getters.

#### `export(): { [P in keyof T]: T[P] }`
- generates a clone of the live state you can pass along without unintended mutations.
- this will only output the values which were enumerable in the source object.
> It's not possible yet to make this work for getters however, sadly. :( 

#### `add(key: string, intital?: any): boolean`
- adds a new tracked value to the live-state. 
- this will return `true` if adding the key succeeded, `false` if did not. (because it exists)
> Not really recommended *after* initializing, but hey.




<br/>

## `useStateful` also accepts an object.

If you prefer to prepare your initial values on the outside of a component, you can do that too.<br/>
This is useful for situations with closures, or something-something HOC's.

> *Just don't give `useStateful` an object literal.*<br/>
> *It will get regenerated every render!* 


```jsx
const defaults = {
    name: "Bob"
}   

const Component = () => {
    const $ = useStateful(defaults);

    return <div>Hello {$.name}</div>
}
```

Keep in mind updated values **are** stored on the given object. This can be helpful or a pain depending on the curcumstances. 

<br/>
<h2>It accepts a function too.</h2>

Well, you knew that, from the first example. However, what you may not have notices is that `componentWillMount` comes ***FREE*** with `useStateful`.

**You heard right folks**, for the low-low price of this single hook, you dont need `useEffect` (with that ugly `[]` argument) after all!

<br/>


```jsx
const Component = () => {
    const $ = useStateful(_ => {

        setInterval(() => {
            $.duration++;
        }, 1000)

        return {
            duration: 0
        }
    });

    return <div>Time sure does fly, {$.duration} seconds has just gone by. 🖋</div>
}
```

You can use this space to declare all of your async opperations, listeners and computed defaults. Thanks to the closure you can access `$` (or whatever you name it), ***but, only. through. functions***.

> Keep in mind that `$` doesn't actually exist until `useStateful` returns, but your event bodies should have no trouble scooping it out of the double-closure. Weird I know. 👀👌

<br/> 

### However, we're definitely missing something here.

That `setInterval` over there should really be cleaned up when the component unmounts. *Totally* meant to do that... Yea.

Let's fix that right up.

```jsx
const Component = () => {
    const $ = useStateful(unmount => {

        const stopwatch = 
            setInterval(() => {
                $.duration++;
            }, 1000)

        unmount(() => {
            clearInterval(stopwatch)
        })

        return {
            duration: 0
        }
    });

    return <div>Well there's {$.duration} seconds I'm never getting back...</div>
}
```

<br/>

### So that's what that underscore was.

Yup, this callback captures a function, to be called when react notices your component is unmounting. 

***Note***: *This can only be set within the initializer function.*
> Effectively it's passed around to the return value of a `useEffect` hook that will run right after your initializer returns. One in the same, of the technique for simulating `componentWillUnmount` with hooks.
>
> I made it `_` in the earlier examples because I find that cleaner than empty parenthesis, visually speaking.

<br/>
<br/>

<h2>And, if can you believe it, it accepts functions as well!</h2>

#### (External ones this time)

It can be pretty useful, to declare your state function itself, outside its respective component. That or better yet, sharing a state factory between multiple components. 

This gives you the breathing room to construct fancy state machines with lots of events and async. Almost as bad as a class even!

> Instead of the closure var, you can use `this` again, to access live state.<br/>
> You couldn't before because of the `this` fowarding of arrow-functions.

**Again however,** you cannot do anything to `this` within the function body, its only a weak reference until bootstrap finishes. 

> The bootstrap process takes place after this function has returned. `This` is here purely to use within closures of the function body.

<br/>

```jsx
function StickySituation(getOutOfThere){
    const deathTimer = setInterval(() => this.countdown--, 1000);

    getOutOfThere(() => {
        clearInterval(deathTimer);
    })
    
    return {
        countdown: 100,
        surname: "Bond",
        async newAgent(_clickEvent){
            const [ someRando ] = await fetch("https://randomuser.me/api/");
            this.surname = someRando.name.last;
        }
    }
}
```

Keeps the **M** and the **VC** nice and seperate.

```jsx
const Component = () => {
    const $ = useStateful(StickySituation);

    return (
        <div>
            <div>Agent {$.surname} we need you to diffuse the bomb!</div>
            <div>If you can't diffuse it in {$.countdown} seconds, the cat may or may not die!</div>
            <div>
                Be sure to <u onClick={$.newAgent}>tap another agent</u> if you think they can do it.
            </div>
        </div>
    )
}
```

### OK, but what if you like, *want* to use an arrow function.

You do you, fam.

```jsx
const OkSomeStateIGuess = (_, self) => {
    //are you happy now?
    illThinkAboutIt
        .then(() => {
            self.opinion = "🤔 mmm'yes. quite."
        })

    return {
        opinion: "ummm"
    }
}
```

> Actually, being honest, that earlier `HiBob` example would work pretty well formatted like this.

<br/>

### 🚧 More ideas are under construction, stay tuned! 🏗

<br/>

# License

MIT license. <br/>

Have fun!<br/>
\- Gabe