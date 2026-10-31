---
title: "Hit me like a trainwreck"
date: 2026-08-28
tags: ["C++", "Software Engineering", "School"]
summary: "Reflections on CS 452 (Real-Time Programming) at the University of Waterloo: building an RTOS from scratch, interfacing with CAN bus, and multi-train coordination."
---

![](https://cdn-images-1.medium.com/max/1024/1*mdWtC2jmSJznrd8AiAfQpQ.jpeg)

2026 January 5th, I took the [**CS 452 — Real-Time Programming**](https://uwflow.com/course/cs452) in my last year of Software Engineering program at University of Waterloo. The course involves implementing a real-time operating system from scratch, modules that interface with CAN bus network, and a system to coordinate multiple trains with extremely limited information.

CS452 is one of the big three CS courses along with Graphics and Compiler courses that are notorious for their difficulties and workloads. Here’s an image of an Excel sheet that my classmate used to track the time spent on the labs.

![Time we are never going to recover from](https://cdn-images-1.medium.com/max/1024/0*sch1ylYKjpw-pLvK.png)
*Time we are never going to recover from*

Note the time entries for TC2 and the final project are missing, but the cumulative time amounts to a bit more than 700 hours over 4 months. TC2 (controlling multiple trains) and the final projects (PACMAN) were exponentially harder than TC1 (controlling one train) as we had to overhaul the entire train control system to coordinate multiple trains and avoid collisions. Before the readers jump to the conclusion of “What’s so hard about this? Just put on a mutex and run Dijkstra/BFS/[Insert your ICPC/undergrad graph algorithms here]”, please allow me to tell you the story from the very very beginning of how this dumpster fire started.

![KittyKernel User Interface](https://cdn-images-1.medium.com/max/1024/1*OCHunHmSRuaWqigqYFQFTw.png)
*KittyKernel User Interface*

## Why am I taking these courses?

To learn more about real-time programming and pushing myself to the limits and see what I am capable of. You can see more information at the [**official course website**](https://student.cs.uwaterloo.ca/~cs452/W26/).

## A0

The first assignment familiarizes students with the basic functionality of the Raspberry Pi, its ARM CPU, and the train controller, while learning techniques for handling asynchronous events by polling. This requires students to read through Raspberry Pi 4 Model B specs, Broadcom BCM2711 handbook, Microchip MCP2515 CAN controller references, ARM Cortex-A72 manual, and an outdated Märklin CAN bus control protocol written in German, for the sake of parsing network packets and handling hardware signals or just printing messages on the screen.

![cs2CAN-Protokoll-2_0.pdf](https://cdn-images-1.medium.com/max/832/1*RfIigdwmZV1DNgj13cPGrA.png)
*cs2CAN-Protokoll-2_0.pdf*

However, the TRUE purpose of assignment A0 is to weed out people who were unsure if they could commit until the end. More than half of the cohort typically drop out by the end of the first week, then more to go. On a positive side, the classroom feels less cluttering.

![](https://cdn-images-1.medium.com/max/1024/1*-g6mZ6vqsrCNdaENFuH7Ig.png)

By the end of A0, I had a basic program with graphical user interface that allows me to send command to change the track switches, trains’ speed/direction, and monitor the physical train track’s sensor states etc. See the “KittyKernel User Interface” image above, but only the left part of the screen.

## K1

The first actual assignment K1 starts on the third week when the population of the class converges to a stable value. The students must form a group of 2, and implement a minimum working version of a simple kernel, this includes:

1. a context switch in and out of the kernel,
2. a request mechanism for providing arguments and returning results,
3. a collection of task descriptors,
4. priority queues for scheduling, and
5. kernel algorithms for manipulating task descriptors and ready queues.

### Language Choice

My team (with Ian Z.) decided to implement the kernel in C++ over C, as it offered class, template, reference for null safety, and other language features with compiled time checks. However, things like STL, non-trivial destructors, exceptions, and other niche things were not available for obvious reasons. This is completely fine, we don’t need all the tools, but just the right tools for the right things. Rust was an option on the table, but getting around the unsafe feature was just as painful as raw C, so eventually people abandoned that ideas. There were several other students suggested OCaml, but they were promptly kicked out of the class. /s

### Task Creation

The first part of the kernel is defining the memory layout and the location of a “Task” using a linker script.

```
SECTIONS {
 . = 0x80000;            /* start text at this location */
 .text.boot : {          /* boot code must come first */
  KEEP(*(.text.boot))
 }
 .text : {               /* rest of code */
  KEEP(*(.text*))
 }
 .init_array : {
  . = ALIGN(4);
  __init_array_start = .;
  KEEP (*(SORT(.init_array.*)))
        KEEP (*(.init_array*))
  __init_array_end = .;
 }

 . = 0x200000;           /* start data at this location for MMU setup */
 .rodata : {
  KEEP(*(.rodata*))
 }
 .data : {
  KEEP(*(.data*))
 }
 .bss : {
  KEEP(*(.bss*))
 }
}
```

The kernel creates a task with the following procedure:

1. Allocate a task id using TidAllocator. Internally it uses a stack data structure to track the freed task id. A task id consists of a generation number, and an index range from 0–127.
2. Allocate a stack frame implicitly by indexing into an array of 128 pre-reserved stack frames with the allocated task id.
3. Allocate a TaskDescriptor meta class implicitly by indexing into an array of 128 pre-reserved TaskDescriptors with the allocated task id.
4. Pretend the beginning of the stack frame already contains the task context, including registers x0 — x30, ESR_EL1, SPSR_EL1, ELR_EL1.
5. Initialize the link register to the Exit() system call, ELR_EL1 to the function entry, and all other registers to 0.
6. Initialize the TaskDescriptor’s fields, and enqueue into the scheduler queue.

### Context Switching

We adopted the “temporary stack” kernel design, where the kernel acts as an event handler. As such, the function call that context switches to a task never returns. And, in svcEntry, the assembly resets the kernel stack pointer back to its initial value. All kernel states that persist between kernel entries are kept as static variables.

1. In the boot loader code, the boot loader sets the exception vector to a dedicated vector with synchronized exception pointing to a function named preSyscallEntry.
2. When a system call is called, the system call calls SVC #N, where N depends on the type of the system call.
3. SVC #N looks up the exception vector, and jumps to preSyscallEntry and switches to the EL1 mode.
4. preSyscallEntry temporarily switches to EL0 stack pointer, and pushes the current task’s context into its dedicated stack. It then switches back to EL1 stack pointer, and calls the syscallEntry(taskStackPointer).
5. syscallEntry(taskStackPointer) is a C function that checks ESR_EL1 to see the svc code, and performs the corresponding system calls operations such as Create, MyTid, Yield etc.
6. The task scheduler then picks the next task based on the priority in a multi-level round robin format.
7. Context switches to the next scheduled task by temporarily switching to EL0 stack pointer, and pops the context registers from the task’s stack. Set ELR_EL1 to the PC to jump to the address with ERET.

![A example of syscall](https://cdn-images-1.medium.com/max/707/1*GrCDzwgiV7hoev3hqO6kqw.png)
*A example of syscall*

## K2

In the second part of the development of the kernel, we implemented a Name Server and a message passing mechanism to allow tasks communicating with each other.

### Name Server

Name Server is a server that maps a task name to its task id. Think of it as a DNS server that maps the easy-to-read website names (like google.com) into computer-friendly numbers called IP addresses (like 142.250.190.46).

In our kernel implementation, we decided to use a static sized array to track all the name-pid mappings. The name does a linear scan to create/delete/get a name entry. The performance here is not a concern, because we cache all the PID look up in other tasks upon name lookup.

```
struct NameEntry {
  int tid;
  char name[MAX_NAME_LENGTH];
};
static constexpr size_t MAX_ENTRIES = 128;
StaticStack<NameEntry, MAX_ENTRIES> nameTable;
```

The Name Server itself has a hardcoded task id, while all other tasks must register with the Name Server upon creation.

### Message Passing

```
int Send(int tid, const char *msg, int msglen, char *reply, int replylen);
int Receive(int *tid, char *msg, int msglen);
int Reply(int tid, const char *reply, int replylen);
```

We added additional task status such as RECEIVED_BLOCKED, REPLY_BLOCKED in the TaskDescriptor class to track the task states. When a task send/receive a message, the task updates its status to one of the BLOCKED states and place itself in a queue until waken up by notifications. This is similar to the Observer pattern but with a few more cases.

### Message Structure

The messages are typically some pure data classes with an enum to indicate the type, and a union of all possible message type. For instance, we defined a Rock Paper Scissor game’s request/response schema as follow:

```cpp
enum class RPSMessageType : uint8_t {
  SIGNUP,
  LOBBY_ASSIGNED,
  QUIT,
};

// Request to sign up to the RPS game.
struct SignUpMessage {};

// Found a match response.
struct LobbyAssignedMessage {
  int lobbyId;
};

// Request to quit the queue or lobby.
struct QuitMessage {
  int lobbyId;
};

// Composite messages.
struct RPSMessage {
  RPSMessageType type;
  union {
    SignUpMessage signUpMessage;
    LobbyAssignedMessage lobbyAssignedMessage;
    QuitMessage quitMessage;
  };
};

// Example usages.
void quitGame() {
  RPSMessage reply = {
    .type = RPSMessageType::LOBBY_ASSIGNED,
    .lobbyAssignedMessage = LobbyAssignedMessage{availableId}
  };
  int ret = ::Reply(tid, reinterpret_cast<const char*>(&reply), sizeof(RPSMessage));
  if (ret < 0) {
    static char buffer[128];
    print(buffer);
  }
}
```

## K3

In the third part of the kernel development, we implemented Event Notification mechanism and a Clock Server. This part was relatively straight forward, as we just needed to look into GICC/GICD (some hardware pins) configurations, and subscribed to the hardware events by writing to the corresponding registers.

```
int AwaitEvent(int eventType);
```

A new entry to the vector table is added alongside the existing syscall entry for IRQs. This performs the exact same context saving as its counterpart for syscalls, except it branches to irqEntry(StackContext*) instead of syscallEntry(StackContext*).

For example, the Clock Server AwaitEvent(TimerSignalEventId) and places itself in a queue. When the hardware fires the timer signal, the OS context switches into the kernel, checks the event type by id, and notifies all the tasks waiting in the queue.

![](https://cdn-images-1.medium.com/max/889/0*pZXZLGrQUDvEDXnl.jpg)

## K4

In the final part of the kernel development, we implemented IO servers that uses event-driven architecture to send/receive data to the GUI or CAN buses. This replaced nearly all the codes written in A0 (lmao). The final architecture looks something like this:

![](https://cdn-images-1.medium.com/max/808/1*M3FP8Pp5GGiql4-ua8N_GA.png)

The operating system implementation later was proven to be **extremely solid** thanks to the defensive programming styles with lots of assertions and test cases (?).

**AND this is it! This is basically everything about the kernel. Unfortunately, this is where the hard mode truly starts.**

## TC1

For the first milestone, the train control program must have the train moving at a constant velocity in a loop and can stop it at a chosen location. To accomplish this, our program must be able to

1. find a route to the location and switch the turnouts, and
2. send the stop command at the right time.

Luckily, the instructors already provided the adjacent graph representation of the train track in C code. This includes which train track segments are connected, and how long each segment is.

```
void init_tracka(track_node *track) {
  track[0].name = "A1";
  track[0].type = NODE_SENSOR;
  track[0].num = 0;
  track[0].reverse = &track[1];
  track[0].edge[DIR_AHEAD].reverse = &track[102].edge[DIR_STRAIGHT];
  track[0].edge[DIR_AHEAD].src = &track[0];
  track[0].edge[DIR_AHEAD].dest = &track[103];
  track[0].edge[DIR_AHEAD].dist = 231;
  track[1].name = "A2";
  track[1].type = NODE_SENSOR;
  track[1].num = 1;
  track[1].reverse = &track[0];
  track[1].edge[DIR_AHEAD].reverse = &track[132].edge[DIR_AHEAD];
  track[1].edge[DIR_AHEAD].src = &track[1];
  track[1].edge[DIR_AHEAD].dest = &track[133];
  track[1].edge[DIR_AHEAD].dist = 504;
  track[2].name = "A3";
  track[2].type = NODE_SENSOR;
  track[2].num = 2;
  track[2].reverse = &track[3];
  track[2].edge[DIR_AHEAD].reverse = &track[107].edge[DIR_AHEAD];
  track[2].edge[DIR_AHEAD].src = &track[2];
  track[2].edge[DIR_AHEAD].dest = &track[106];
  track[2].edge[DIR_AHEAD].dist = 43;
  track[3].name = "A4";
  track[3].type = NODE_SENSOR;
  track[3].num = 3;
  // More codes to go.
```

![](https://cdn-images-1.medium.com/max/1024/0*mVy3MxY_TbUhtXgi.png)

In our first iteration, we attempt to model the train and the train track as follows:

### Train

```
struct Train {
  bool touched;
  bool forward;
  TrainStateMachine stateMachine;
  SpeedLevel speedLevel;
  Speed estimatedSpeed;
  uint32_t lastCalibrateTicks;
  TrackNode* lastVisitedNode;
  Distance estimatedOffsetFromLast;
  TrackNode* estimatedNode;
  Distance estimatedOffsetFromEstimatedNode;
  Distance estimatedPathDistance;
  RingBuffer<TrackNode*, NUM_TRACK_NODES> path;
};
```

Each train contains information like the user desired speed level, direction, estimated position, estimated speed, and the train path.

At any given time, a train can only be in one state indicated by the StateMachine type { Idle, Reversing, Locating, Pathing }.

Idle: The train has no active task.

Reversing: The train is reversing.

Locating: The train is calibrating its position.

Pathing: The train is going to the destination following a path.

When a train triggers a sensor, the sensor checks the owner of the sensor node, and calls the corresponding calibrateTrain() function to update the owning train’s estimated motions. This includes the estimated speed using time weighted average method.

### Path Finding System

When the user instructs the train to goto a location, the train must transit across the Locating state and the Pathing state.

### Locating State

The train first acquires the ownership of all sensors in the inner loop. If successful, then the system changes all the switches to direct the train into the 8 shape loop, and waits for the train to hit a sensor on the loop to locate its position. If the train hits a sensor on the loop, the train runs the Dijkstra algorithm to find the path to the destination.

### Pathing State

The train follows the path to the destination and changes the switch while running. Wherever the train hits a sensor, it calculates the distance to the previous hit sensor and the elapsed time to adjust its estimated speed.

The system simulates the train’s motion every tick to estimate the current position on the track even without hitting the sensors. If the system estimates that the train is within the stopping distance to the destination, the system sets the train speed level to 0. The stopping distance depends on the speed level and it is hardcoded from measured data.

This implementation was sufficient enough for the TC1 lab demo evaluations, but very soon turned into Legacy Code™ *and *Tech Debt™. I admit that I designed and wrote majority part of this garbage along with many other malfunctional features that I’m too ashamed to describe here in the blog. Sorry, Ian, but you were too busy with your English essay. Seriously, who takes English course in their final year of undergrad?

## TC2

TC2 is when the dumpster fire rages and fueled by all the tech debt from TC1. TC2 requires a train control system that coordinate multiple trains in real time. There are lots of implementation challenges that’s worth highlighting:

### Sensor Attribution

> When two or more trains are moving simultaneously, each sensor report is either spurious or caused by one of the trains. Your implementation should consistently attribute sensor reports to the correct train.

The train control system receives a network message like “Sensor A4 is pressed down”, but it does not have the capability to tell you WHICH train pressed it. To solve this problem, we implemented an ownership heuristic that calculates the “ownership score” based on the following criterions:

1. The train is currently holding the reservation on that sensor’s node.
2. A train whose predicted next sensor matches the event.
3. A train currently in Lost kinematics state.

```
// Score weights are arbitrary.
// We didn't have the time or money or RAM to train a machine learning model.
SensorAttributionCandidate candidate{.trainId = trainId, .score = 0};
marklin::Train& train = context.ttState.getTrain(trainId);
if (reserverId == trainId) {
  candidate.score += 400;
} else if (train.navigation.state == marklin::NavigationSystem::State::Routed) {
  candidate.score -= 500;
} else if (train.navigation.state == marklin::NavigationSystem::State::Manual) {
  candidate.score += 30;
}

if (train.prediction.sensor && train.prediction.sensor->id == sensor.id) {
  candidate.score += 300;
}

if (train.kinematics.state == marklin::KinematicsSystem::State::Tracked) {
  marklin::Distance distToSensor =
      kit::min(marklin::shortestDistanceToNode(context.ttState, train.kinematics.estimatedNode->id, sensor.id) -
                   train.kinematics.estimatedNodeOffset,
               marklin::shortestDistanceToNode(context.ttState, sensor.id, train.kinematics.estimatedNode->id) +
                   train.kinematics.estimatedNodeOffset);
  if (distToSensor < marklin::INF_DISTANCE) {
    int32_t distanceScore = -distToSensor / 1000;
    candidate.score += distanceScore;
  } else {
    candidate.score -= 10'000;
  }
} else {
  candidate.score -= 30;
}
```

After ownership is resolved, the server logs the event, updates the train’s kinematics from the measured inter-sensor distance and elapsed ticks, and finally predicts the next sensor and when it should occur.

### Collision Avoidance

> Train collisions should be avoided. This requires you to define a policy that makes it impossible for two trains to occupy the same location at the same time, and to implement your policy. You can avoid collisions in the time domain (slowing, pausing) and/or space domain (alternative path). However, trivial non-collision algorithms, such as only running one train at a time, are not acceptable.

To solve the problem, we implemented a new PathFindingSystem responsible for reserving the track nodes and changing the switches’ directions for the train every tick.

```cpp
class PathFindingSystem {
  // Omitted
  std::array<RingBuffer<TrainId, MAX_TRAIN_ID>, NUM_RESERVATION_NODES> nodeOwners{}; // FIFO reservation order.
  std::array<TrainId, NUM_RESERVATION_NODES> blockers{};
  std::array<TrainPath, MAX_TRAIN_ID> paths{};
  std::array<PathingState, MAX_TRAIN_ID> pathingStates{};
  // Omitted
};
```

When a routing request arrives, the train enters FindingPath state. Once the train has a tracked position, the path planner runs a modified version of Dijkstra search from the train’s current estimated location to the destination. The search:

- Explores all legal outgoing edges from each node,
- Treats nodes reserved as the destination of another train as impassable,
- Adds a penalty for nodes with queued reservation waiters, so the planner biases away from congested regions,
- If a path is found, the planner reconstructs it from the parent map, stores the ordered path nodes, and reserves each node. The reservation system consists of a FIFO queue for each train segment. While the train is moving, the planner continuously updates the route state. It also proactively sets branch directions for the next few path nodes ahead of the train, which avoids flipping a switch underneath the train.

### Robustness

> Your application is expected to be robust against a ‘reasonable’ level of errors in sensor reports and changes in the state of the turn-outs. In addition, it should avoid typical problems, such as switching a turnout while a train is passing. The route finder should be able to respond to changes in track configuration caused by unavailability of track segments. Train control should drive a train fast enough to not get stuck.

This is by far the most challenging problem that almost no team solved perfectly. Remember the Dijkstra algorithm I mentioned in the path finding system earlier? If you ctrl c/v it from the textbook, then it simply will not work. The classic Dijkstra treats all the vertices as a single point with no physical volume. But guess what? The toy train manufactured by Märklin is a real physical object in real life with real volume (the last time I checked). Imagine a train locates at the left side with the destination at the right side, and a crossway in the middle. If we don’t take train’s length into account, then the second half of the train will lie on the intersection and cause potential collision.

![AI Illustration](https://cdn-images-1.medium.com/max/1024/1*YaZMbksoS2KJ4Yu9IXp-OA.jpeg)
*AI Illustration*

Similarly, if the train stops on a branch (a branch has a magnetic switch underneath that changes the direction), then the switch can physically topple a train or tilt the train to cause it having a multi-track drifting.

![](https://cdn-images-1.medium.com/max/680/0*SJ6143kh0lsBMz4X)

In our implementation, we checked the train segment before and after. If there’s a branch in front of the destination, then we stop the train ahead of the time with a safety margin. If there’s a branch behind the destination, then we overshoot the train by a safety margin.

### Nothing is reliable

**BUT! BUT! BUT!** These are all based on the assumption that if we know the exact kinematics state of the train. And we don’t! All the train models accelerate non-linearly at a different rate and require different time to reach different terminal speed. Every train is different, some are like Lightning McQueen that speeds up and slowdown in no time, and some are like me on Weekend who barely touch grass outside. In addition, the train track was being abused by students 24x7, and the train and tracks components literally broke down into pieces before the students did.

![](https://cdn-images-1.medium.com/max/364/1*RE4ADCetbxASAspZlBszyQ.png)

![](https://cdn-images-1.medium.com/max/351/1*i3V9ojPJu1Q_sYP2AoAOhw.png)

![](https://cdn-images-1.medium.com/max/375/1*xpIbuFADwpXj0wivvDIJCQ.png)

As results, a train often fails to stop in time and trespass into a train segment that it did not reserve in the Pathfinding system. The solution to recover from these erroneous states aren’t trivial either. You can’t simply just rewind the trespassing train back to the previous train segment, because that train segment’s ownership was released and other train can arrive and occupy there, which forces us to rewind that train as well and cause a chain reaction. We tried to improve our measurement data, upgrade the physics model from high school level to undergrad level, change the trespassing detection algorithm, but none of them work well enough to prevent the train from crashing before the 5 mins running time landmark. These types of reliability/robustness issues took up &gt; 80% of our time.

![The Meme Window That Peak Into The Hell](https://cdn-images-1.medium.com/max/1024/0*O7SxORcoEVEusnK_.jpg)
*The Meme Window That Peak Into The Hell*

We did, however, eventually came up with a relatively more reliable method to recover from the error that worked a lot better and was sufficient enough for TC2 lab demo evaluations: When we detect any trespassing error, reset the entire system and reroute all trains from scratch. Who could have thought sometimes the simplest and the stupidest method works the best, huh? By the time we finished TC2, the code size has grown to over 10k lines of code with considerably more complex Train modelling codes.

```cpp
// This is just for the Train alone!
class NavigationSystem {
  struct FindingPathTask {
    TrackNodeId dest = 0;
    Distance offset = 0;
    SpeedLevel maxSpeedLevel = 0;
    bool isReversing = false;
    bool reqeusetToResume = false;
    bool isResumed = false;
    uint32_t retryAtTicks = 0;
    uint32_t retryBackoffTicks = 0;
  };

  struct ReversingTask {
    SpeedLevel preReversingSpeedLevel = 0;
  };

public:
  enum class State { Manual, FindingPath, Routed, Reversing };
  State state = State::Manual;
  PathingState oldPathingState = PathingState::Idling;
  FindingPathTask findingPathTask{};
  ReversingTask reversingTask{};
  bool isWandering = false;
};

class KinematicsSystem {
public:
  enum class State { Lost, Tracked };
  State state = State::Lost;
  TrainDirection direction = TrainDirection::Forward;
  SpeedLevel offlineSpeedLevel = 0;
  Speed offlineSpeed = 0;
  Speed estimatedSpeed = 0;
  struct TrackNode* lastSensor = nullptr;
  Distance lastSensorOffset = 0;
  uint32_t lastSensorTicks = 0;
  struct TrackNode* estimatedNode = nullptr;
  Distance estimatedNodeOffset = 0;

  void triggerSensor(TrackNode& sensor, Distance dS, uint32_t ticks);
  void reverseSensor();
  bool isStationary() const;
  void onTick(struct TrainTrackState& ttState, TrainId trainId);
};

struct SensorPredictionSystem {
  struct TrackNode* sensor = nullptr;
  uint32_t predictedTicks = 0;
  int32_t lastTimeErrorTicks = 0;
  Distance lastDistErrorUm = 0;

  void triggerSensor(TrackNode& triggeredSensor, TrackNode* nextSensor, Distance distToNext, Speed estimatedSpeed,
                     uint32_t currentTicks);

struct Train {
  NavigationSystem navigation{};
  KinematicsSystem kinematics{};
  SensorPredictionSystem prediction{};
};

/**********************************
Train Track Definition
***********************************/

struct TrainTrackState {
private:
  uint32_t currentTrack;
  std::array<Train, MAX_TRAIN_ID> trains{};
  TrackSet trackA{};
  TrackSet trackB{};
  std::array<SwitchState, NUM_SWITCHES> switches{};

public:
  TrainTrackState();

  void reset();

  Train& getTrain(TrainId id);
  SwitchState getSwitchState(SwitchId id) const;
  void setSwitchState(SwitchId id, SwitchState switchState);
  void setCurrentTrack(TrackId id);
  TrackId getCurrentTrackId() const;

  TrackNode& getTrackNodeById(TrackNodeId id);
  TrackNode* getTrackNodeByName(const char* name);
};
```

This design is still bad as it bundles the navigation and pathfinding modules, according to the professor Martin.

## Final Project

In the final project, we implemented the PACMAN game where the human player controls a train to trigger all the sensors before the 2 AI controlled trains catch you. We spent majority of the time fixing TC2 and left with little time for the final project. In addition, we were being overly ambitious, and the scope was a bit too big, so the end result wasn’t ideal, but it is what it is. The last night in the lab was really memorable: The TA brought pizza to cheer us up, everyone pulled an all nigher and fixing TC2 (some group was stuck at TC1). We were doing “anonymous” surveys about how regrettable you are taking this course, or when was the last time you showered.

> We later discovered that people could easily achieve high evaluation rating on the final project by simply choosing an easier topic (driving two trains back and forth). So it is more about fulfilling the promises you make, rather than how fancy the project is.

## Conclusion

When looking back retrospectively, I’m glad I took this course and truly understood how much I have grown during university as a software engineer and an adult.

> [Professor Martin Karsten, who currently teaches the course, likes to quote a student review from Reddit. “CS452 is not so much a course as a self-discovery journey,” the student wrote. “[It] is really about learning how much you’re willing to sacrifice in pursuit of winning, even facing certain defeat. You will discover just how far you can truly push yourself. And yet, almost everyone comes up short of what they set out to do. I don’t think anyone in my class was totally satisfied with their final result.”](https://uwaterloo.ca/computer-science/news/chaos-code-community-cs452-trains-lab)

## Summary

EGO: Crushed.

Sleep schedule: 404

Hours Spent: 700+ hours over 4 months.

Workload: &gt; 12,000 lines of C++ code.

Friend Made: Everyone in the class.

## Bonus

Some students funded a Märklin train with a steam engine, and donated to the train lab. This thing apparently costed $1000.

![](https://cdn-images-1.medium.com/max/1024/1*9at9rbYQseU1XT4dqRmTnQ.jpeg)

[https://medium.com/media/b3ada022879e9bc1c28e4e2e47e46bc2/href](https://medium.com/media/b3ada022879e9bc1c28e4e2e47e46bc2/href)

---
*Originally published on [Medium](https://unboxthecat.medium.com/hit-me-like-a-trainwreck-adb6ae221abf?source=rss-1992b6042956------2) on August 28, 2026.*
