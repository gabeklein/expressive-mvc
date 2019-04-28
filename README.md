
<h1 align="center">
  Use Stateful
</h1>

<p align="center">
  Easy to use live-state with react hooks
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
import { useStates } from "use-stateful";
```

<br/>

## What does it do?

Use stateful is a great alternative to having a bunch of `useState` calls within your components. A single `useStates` hook can manage pretty much all the simple state in your component.

In a nutshell, this hook grafts ✨*live-state* ✨ onto some given state and returns it to you through the hook. 

### ✌️live state ✌️?

Basically it is a new object, inheriting (via prototype) from the one you passed into `useStates`. In it, all of the "live values" (enumerable, non-methods) are covered over by `setter` & `getter` pairs. It uses the given state object for initial values and to know what setters are needed for tracking. The hook will then watch for updates to those values, compare them, and if they're different... trigger a render! 🐰🎩

<br/>

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

<br/>

### How can we do better?

> Use the `useStates` hook.

```jsx
const HappyTown = () => {
    const $ = useStates(_ => ({
        name: "John Doe",
        emotion: "whatever",
        reason: "I dunno man."
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

The hook's argument over there, its "*constructor*", will ***only run at mount***, and the returned object will then be bootstrapped into live state.

The component now updates when any of your declared values change. You can add as many values as you like, and they'll stay clean and relatively organized in your code.

> And John Doe seems pretty mollified by this development now too.

<br/>

## Adding Methods

Similar to `@computed` and `@action` found in [MobX.js](https://github.com/mobxjs/mobx), you can include `get`, `set`, and methods amongst your watched values. 

They'll reference your live state and work [generally as you'd expect](https://www.destroyallsoftware.com/talks/wat), with regards to the `this` keyword.

All methods are **bound automatically**, so you can pass them as callbacks or to sub-components, and they'll work just fine.

<br/>

```jsx
const HiBob = () => {
    const $ = useStates(_ => ({

        ownName: "Bob",
        friend: undefined,

        get hello(){
            return `Hello, my name's ${this.name}.`;
        },

        set friend(name){
            void name;
            //immediately forget;
            this.friend = "dude"
        },

        sayHi(){
            const whatsHisFace = this.friend;
            if(whatsHisFace){
                alert(`Oh hey ${whatsHisFace}, how's it uh, hangin? 🤙`)
                return;
            }

            alert(this.hello);

            const whoIsThisGuy = prompt("Hey uuuhh...");

            if(whoIsThisGuy){
                alert(`Oh hey ${whoIsThisGuy}! Long time no see!!`);
                this.friend = whoIsThisGuy;
            }
            else 
                alert(`Heeeey, ...There..?`);
                //you friggin blew it Bob
        }
        
    }));

    return <div onClick={$.sayHi}>Hi {$.ownName}</div>
}
```

> As you'll see later, this is not an ideal way to code Bob here. However, for base concepts, this works fine for now.

<br/>

### Reserved methods

#### `refresh(): void`
- requests a re-render without requiring that a value change. 
- Helpful when working with getters and async.

#### `export(): { [P in keyof T]: T[P] }`
- generates a snapshot live state you can pass along without unintended side effects.
- this will only output the values which were enumerable in the source object.

#### `add(key: string, intital?: any): boolean`
- adds a new tracked value to the live-state. 
- this will return `true` if adding the key succeeded, `false` if did not. (because it exists)
> Not really recommended *after* initializing, but hey.

<br/>

## `useStates` also accepts an object

If you prefer to prepare your initial values, on the outside of a component, you can do that too.<br/>
This can be especially useful for situations with closures or [HOC's](https://reactjs.org/docs/higher-order-components.html).

> *Just don't give `useStates` an object literal.*<br/>
> *It will get regenerated every render!* 


```jsx
const defaults = {
    name: "Bob"
}   

const Component = () => {
    const $ = useStates(defaults);

    return <div>Hello {$.name}</div>
}
```

Keep in mind updated values **are** stored on the given object. This can be helpful or a pain depending on the curcumstances. 

<br/>

## It accepts a function too

Well, you knew that, from the first example. However, what you may not have noticed is that `componentWillMount` comes ***FREE*** with `useStates`.

**You heard right folks**, for the low-low price of this single hook, you dont need `useEffect` (with that ugly `[]` argument) after all!

<br/>


```jsx
const TimeFlys = () => {
    const $ = useStates(_ => {

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

You can use this space to declare all of your async opperations, listeners and computed defaults **and interact with them**. 

Thanks to the closure you can access `$` (or whatever you name it), ***but, only. through. functions***.

> Keep in mind that `$` doesn't actually exist until `useStates` returns, though your callbacks should have no trouble scooping it out of the double-closure. Weird I know.

<br/> 

### However, we're actually missing something here.

That `setInterval` over there should really be cleaned up when the component unmounts.

Let's fix that right up.

```jsx
const PaintDries = () => {

    //wish you had access to ComponentWillUnmount?
    //handle cleanup with ↓     ↓; it adds an event listener for that!

    const $ = useStates(unmount => {

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


#### Argument `addEventListener(componentWillUnmount)` to the rescue!

This callback captures a function, to be called when react notices your component is unmounting. 

***Note***: *The opposite of `$`, unmount can only be set **within** the initializer function.*

> Effectively it's passed around to the return value of a `useEffect` hook that will run right after your initializer returns. One in the same, of the technique for simulating `componentWillUnmount` with hooks.
>
> I made it `_` in the earlier examples because I find that cleaner than empty parenthesis, visually speaking.

<br/>
<br/>

<h2>And, if can you believe it, it accepts functions as well</h2>

#### (External ones this time)

It can be pretty useful to declare, your state function itself, outside of a respective component. That, and better yet, sharing logic between multiple components is possible with this approach. 

This gives you the space to construct fancy state machines with lots of events and async, without bloating your components.

> Instead of the closure var, you can use `this` again, to access live state.<br/>
> You couldn't before because of the keyword fowarding done by arrow-functions.
>
> **Again however,** you cannot do anything to `this` within the function body, its only a weak reference until bootstrap finishes. 
>
> The setup process takes place only after this constructor has returned. `this` is here, purely to use within closures in the function body.

<br/>

```jsx
function StickySituation(ohTheyRanAway){
    const deathTimer = setInterval(() => {
        const remains = --this.countdown
        if(remains == 0)
            cutTheDrama();
    }, 1000);

    function cutTheDrama(){
        clearInterval(deathTimer)
    }

    ohTheyRanAway(cutTheDrama)
    
    return {
        countdown: 60,
        surname: "bond",
        async newAgent(_clickEvent){
            const recruit = await 
                fetch("https://randomuser.me/api/")
                .then(res => res.json())
                .then(data => data.results[0])

            this.surname = recruit.name.last;
        }
    }
}
```

Keeps the **M** and the **VC** nice and seperate.

```jsx
const ActionSequence = () => {
    const $ = useStates(StickySituation);

    if($.countdown == 0)
        return <h1>🙀💥</h1>

    return (
        <div>
            <div>Agent <b>{$.surname}</b> we need you to diffuse the bomb!</div>
            <div>
                If you can't diffuse it in {$.countdown} seconds, the cat may or may not die!
            </div>
            <div>
                But there is time! 
                <u onClick={$.newAgent}>Tap another agent</u> 
                if you think they can do it.
            </div>
        </div>
    )
}
```

<br/>

### OK, but what if you like, *want* to use an arrow function?

Yea you don't have access to `this` here, but we got you. <br/>
State is passed as a second argument after unmount.

```jsx
const OkSomeStateIGuess = (_, self) => {
    //are you happy now?
    ThinkAboutIt()
        .then(() => {
            self.opinion = "quite happy"
        })

    return {
        opinion: "ummm"
    }
}
```

#### Infact, this is exactly the better way to implement `HiBob` from his earlier example.

```jsx
const HiRobert = () => {
    const Bob = useStates(ForRobert);
    // and btw, there's nothings stopping you from loading even more live states!

    return <div onClick={Bob.sayHi}>Hi {Bob.ownName}</div>
}

const ForRobert = () => ({
    ownName: "Robert",
    friendsName: undefined,

    get hello(){
        return `Hey, name's ${this.name}.`;
    },

    set friend(name){
        this.friendsName = name
    },

    sayHi(){
        const friend = this.friendsName;
        if(friend){
            alert(`Hey ${friend}, how was vacation?`)
            return;
        }

        alert(this.hello);

        const guysName = prompt("You look familar! What's your name again?");

        if(guysName){
            alert(`Ohhh ${guysName}! Long time no see.`);
            this.friendsName = guysName;
        }
        else 
            alert(`How've you been, you're just coming back from vacation right?`);
            //Nice save robert
    } 
});
```
<br/>

### 🚧 More ideas are currently under construction, so stay tuned! 🏗

<br/>

# License

MIT license. <br/>