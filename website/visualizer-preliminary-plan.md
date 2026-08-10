# COMP4050 Epic Team Visualizer - Preliminary Plan
This document concerns the early planning of the visualizer a system that visualizes solutions to the [bin packing problem](https://en.wikipedia.org/wiki/Bin_packing_problem) in 3D. It is to interface with a website portal system that will deliver packaging solutions to display. 

## Functionality

### Key Features
 * 3D Visualisation of the package
   * Display box/container
   * Display items inside of box
   * Display total items in box
   * Box is transparent to view interior contents
   * Proportions of displayed objects are realistic
   * User can change their view angle by swiping up/down/left/right on the display panel
   * User can zoom into the container for a more detailed view
 * Step-by-step packaging instructions
   * Display list of required items before showing instructions
   * Demonstrate package being loaded with individual items
   * Users trigger when to view the the next item being loaded in, allowing users to pack at their own pace
   * Instructions use visual animation to clearly demonstrate how the product is placed

### Technical Performance Measures
Assuming the software is running on a typical smartphone.
| TPM ID | TPM Title | Description | Measurement | Target |
| -- | -- | -- | -- | -- |
| TPM-01 | Load Time | How long after starting up is the software fully usable? | Time | < 1 second |
| TPM-02 | Frame Rate | How often does the 3D visualiser regenerates its image? | Frequency | > 60hz |
| TPM-03 | Response Time | How long after input is provided does the software respond? | Time | < 5 milliseconds
| TPM-04 | Render Time | Time from receiving valid packing solution data -> displaying a fully rendered box. | Time | < 1 second |
| TPM-06 | Animation Smoothness | Ensure a smooth user experience when user is interacting with the box render | Frame rate | 60 FPS ± 10% |


### Immeasurable Performance Factors
| Title | Description | Heuristic Measure |
| -- | -- | -- |
| Suitability | Utilizing the software is more productive than avoiding it | User satisfaction rate, user packing time comparison |
| Usability | Software is intuitive to use | User training time, navigation backtracking rate |
| Privacy | Software is secure from data leaks | How many ways the application data be accessed |
| Accessibility | The interface remains usable for users with different device needs. Information is not communicated by colour alone. | Accessibility review, contrast checks, user feedback |
| Learnability |Someone new to the interface can understand the main controls and complete a packing task with minimal instruction. | Time taken to complete a first packing task, number of issues |
| Maintainability | Developers can safely update the visualiser when the solver data format or visual requirements change. | Time required to implement a small change / feature, test coverage |

### Testing
| Testing Type | Description | FitVisualizer Examples | Tools |
| -- | -- | -- | -- |
| Unit Testing | Tests individual functions and modules in isolation. | Validate packing data, calculate item counts, convert solver coordinates and rotations into Three.js values, determine the current packing step. | Vitest |
| React Component Testing | Tests React components from the user's perspective, including what is displayed and how controls respond. | Test container summary, next/previous buttons, loading state, error message, selected-item details, and progress indicator. | Vitest + React Testing Library |
| Regression Testing | A collection of existing automated tests that runs after changes, ensuring previously working functionality has not broken. | Run all unit and React component tests whenever changes are pushed or a pull request is created. Add a test whenever a bug is fixed. | Vitest + React Testing Library + GitHub Actions |


## Tech Stack
| Technology | Usage |
| -- | -- |
| [TypeScript](https://www.typescriptlang.org/) | Type safe code |
| [Next.js](https://nextjs.org/) | Application framework, routing, layouts |
| [React](https://react.dev/) | GUI, State Management |
| [Vite](https://vite.dev/) | React development server and production build tool |
| [Node.js](https://nodejs.org) | Server runtime |
| [three.js](https://threejs.org/) | 3D rendering on browser |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | React component tests |


## System Architecture
### Project Decomposition
A visualizer system is analysed for smaller sub-systems to enable divide-and-conquer project planning.
Segmenting the project into smaller parts allows for the progress to be tracked as well as workloads divided among team members.

Sub-components:
* **API** - Responsible for interfacing with external applications
  * **Receiver** - Listens for incoming data
  * **Parser** - Converts incoming data to a native format, or rejects it if incompatible
  * **Responder** - Sends feedback to other applications as required
* **3D Renderer** - Responsible for converting box solution data into a 3D image
  * **Image Generator** - Function that create a 2D image based on the 3D scene data
  * **Packer** - Loads and controls packing solution data into the 3D environment
  * **"Cameraman"** - Allows the camera to be manipulated to necessary view points in the scene
* **Controls** - Responsible for allowing user to interface with the software
  * **Event Listener** - Listens for user input events and provides other modules means to subscribe
  * **Navigation** - Changes the state of the application as required
  * **Instruction Reader** - Generates instructions for packing
  * **3D Camera Manipulation** - Controls for the user to change the camera position/rotation of the scene
* **Animator** - Responsible for modifying visual data over a timeframe
  * **Clock** - Maintains time, allowing for framerate-independant motion
  * **Interpolator** - Algorithm for deciding the value between two given points at some ratio
  * **Scheduler** - Service that can schedule animations to be played

``` mermaid
---
title: Visualizer System Decomposition
---
mindmap
Visualizer
    Application Programming Interface
        Receiver
        Parser
        Responder
    3D Renderer
        Image Generator
        Packer
        Camera Manager
    Controls
        Event Listener
        Navigation
        Instruction Reader
        3D Camera Manipulation
    Animator
        Clock
        Interpolator
        Scheduler
```

### Component Modelling
``` mermaid
---
title: Program Data Flows
---
flowchart RL
    subgraph Threshold
        internet@{ shape: cloud, label: "Internet" }
        user@{ shape: trapezoid, lable: "User" }
    end

    subgraph API
        receiver(Receiver)
        parser(Parser)
        responder(Responder)
    end

    subgraph 3D Renderer
        interpreter(Packer)
        renderer(Image Generator)
        camera(Camera Manager)
    end
    
    subgraph Controls
        input(Input Listener)
        navigator(Navigation)
        instructions(Instruction Reader)
        viewer(Camera Manipulation)
    end

    subgraph Animator
        clock(Clock)
        interpolator(Interpolator)
        scheduler(Scheduler)
    end

    internet --> |Raw Packing Data| receiver

    user --> |Input| input

    receiver --> |Raw Packing Data| parser

    parser --> |Parse Result| responder
    parser --> |Native Packing Data| instructions

    responder --> |Feedback| internet

    interpreter --> |Package Layout| renderer
    interpreter --> |Event| scheduler

    renderer --> |Visual Image| user

    camera --> |Camera Position Data| renderer

    input --> |Button Press| navigator
    input --> |Swipe| viewer

    navigator --> |Button Layout| user
    navigator --> |Instruction Request| instructions
    navigator --> |Event| scheduler

    instructions --> |Package Update| interpreter

    viewer --> |Camera Transform| camera

    clock --> |Time Update| scheduler

    scheduler --> |Property Update| interpreter
    scheduler --> |Property Update| navigator
    scheduler --> |Keyframe Data| interpolator
    
    interpolator --> |Interpolated Value| scheduler

```

``` mermaid
---
title: Program States
---
flowchart
    start(((Start)))
    idle((No packaging data))
    list((Display required items))
    item((Show item))
    placement((Show item placement))
    conclusion((Finalize package))
  
    start --> idle

    idle --> |Package Data Loaded| list

    list --> |List Items Confirmed| item
    
    item --> |Confirm Item| placement
    item --> |Check Previous Item| item
    
    placement --> |Confirm Placement with Items Remaining| item
    placement --> |Confirm Placement with No Items remaining| conclusion

    conclusion --> |Package Finalized| idle

```

## Collaboration Tools
| Tool | Usage |
| -- | -- |
| **GitHub** | Collaborative code repository |
| **Discord** | Developer communication forum |
| **Trello** | Task assignment and tracking |

