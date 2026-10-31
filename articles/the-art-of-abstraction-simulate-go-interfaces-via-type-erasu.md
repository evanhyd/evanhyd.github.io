---
title: "The Art of Abstraction — Simulate Go interfaces via type erasure"
date: 2025-01-27
tags: ["C++", "Software Development"]
summary: "In the **Go programming language**, a class satisfies an interface if it implements all its functions."
---


In the **Go programming language**, a class satisfies an interface if it implements all its functions.

```go
type Walker interface {
 run()
}

type Swimmer interface {
 swim()
}

type Human struct{}
func (Human) run() { fmt.Println("human run") }
func (Human) swim() { fmt.Println("human swim") }

type Salmon struct{}
func (Salmon) swim() { fmt.Println("fish swim") }

func main() {
 var walker Walker = Human{}
 walker.run()

 var swimmer Swimmer = Human{}
 swimmer.swim()
 swimmer = Salmon{}
 swimmer.swim()
}
```

Interface provides great flexibility and decoupling, as it emphasizes the separation of interface and implementation without introducing inheritance complexity.

Surprisingly, C++ can, in fact, realize the same type of interface through the power of templates and the [adapter like pattern](https://refactoring.guru/design-patterns/adapter).

## Case Analysis:

Alice is your average software engineer intern (100$/hour) at one of the prestigious MANGA companies (Metal, Amazin, Netflee, Goggles, Apes). Her job involves sending actions to a queue and process them periodically.

```cpp
/* 
  From external libraries developed by different teams.
  Do not have access to modify the classes.
  All classes have the method: void execute(User&).
  Over 100 classes and counting.
*/
class User;
class CollectInfo;
class PlayAd;
class SlowDownDevice;
...
...
...

// Alice's code
void spin(User& user) {
  vector<???> queue;

  while (waitInput()) {
    switch (input) {
      case COLLECT_INFO: // Add CollectInfo object to the queue.
      case PLAY_AD:      // Add PlayAd object to the queue.
      case SLOW_DOWN:    // Add Slowdown object to the queue
      // and so on
    }
    if (isTimeToProcess()) {
       for (auto action : queue) {
         action.execute(user);
       }
    }
  }
}
```

Unfortunately, all these classes don’t share any base class, because they were implemented by the engineers from the last century.

![xkcd: Dependency](https://cdn-images-1.medium.com/max/385/0*GMTgHjPriWmGHBXJ.png)
*xkcd: Dependency*

Yet, Alice must put them into a single queue as the ticket requirement suggests. Fortunately, all these classes implement the same void execute(User&) method. This is where type erasure comes to rescue.

## Interface

The first step is to create a common base class for all the action classes. The interface contains a void execute(User&) since this is the function we want to call on all the actions in the queue.

```cpp
class ActionInterface {
  virtual void execute(User&) = 0;
};
```

## Adapter

Next, we create a template adapter for all the action classes. All these adapter classes inherit the ActionInterface, which essentially establishes a common base class for all the action classes. In short, this is a generic wrapper that inherits the base class ActionInterface, and forward the execute() call to its wrapped object.

```cpp
template <typename T>
class ActionAdapter: ActionInterface {
  T t;

  virtual void execute(User& user) override {
    t.execute(user);
  }

public:
  ActionAdapter(T action) : t(action) {}
};
```

## Result

By combining the ActionInterface and ActionAdapter, we can now add any object into the container as long as it has the public method execute(User&) implemented. Albeit a bit complicated, we are able to simulate a Go interface using type erasure and help out (imagined) Alice. Hooray!

```cpp
int main() {
  User user{};

  vector<ActionInterface*> actions;
  actions.push_back(new ActionAdapter{CollectInfo{}});
  actions.push_back(new ActionAdapter{PlayAd{}});
  actions.push_back(new ActionAdapter{SlowDownDevice{}});
  for (auto action : actions) {
    action->execute(user);
  }
}

/*
Output:
collect info
play ad
slow down
*/
```

## Enhancement

Some people may find the **new ActionAdapter{object}** unintuitive and verbose. It is possible to eliminate this explicit wrapping by creating another wrapper class.

```cpp
class Action {
  shared_ptr<ActionInterface> object;
public:
  template <typename T>
  Action(T t) : object(make_shared<ActionAdapter<T>>(t)) {}

  void execute(User& user) {
    object->execute(user);
  }
};

int main() {
  User user{};

  vector<Action> actions;
  actions.push_back(CollectInfo{});
  actions.push_back(PlayAd{});
  actions.push_back(SlowDownDevice{});
  for (Action action : actions) {
    action.execute(user);
  }
}
```

The Action class contains a templated constructor that creates a corresponding ActionAdapter depending on the argument type. In addition, I used a shared_ptr to avoid leaking memory. This is just one simple example of how you can enhance the wrapper class. Go wild with it!

Full Code: [https://godbolt.org/z/rYzos9z8h](https://godbolt.org/z/rYzos9z8h)

---
*Originally published on [Medium](https://unboxthecat.medium.com/the-art-of-abstraction-simulate-go-interface-via-cfbc34c6c412?source=rss-1992b6042956------2) on January 27, 2025.*
