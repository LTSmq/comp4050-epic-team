# Epic Team: Solver, Portal and Visualizer
This repository is for the development of a product that solves the [bin packing problem](https://en.wikipedia.org/wiki/Bin_packing_problem) in the context of accessability to a warehouse worker.
The warehouse worker should be able to connect to a web interface over their mobile device and view packing instructions for their order within a short period of time. 

Development is segmented into 3 teams corresponding to 3 parts of the program:
 * **Solver**: A module that provides an appropriate solution to the bin packing problem in as short of time as possible.
 * **Portal**: A service that links information across the system.
 * **Visualizer**: A program that displays a cohesive rendition of the packaging solutions.

Below is a proposal for how the data should flow between modules. "Internet" implies an exposed endpoint for authorized users hosted by the portal.
 ``` mermaid
 ---
 title: Proposal of data flows
 ---
 flowchart
    S((Solver))
    P((Portal))
    V((Visualizer))
    I@{shape: cloud, label: Internet}

    I --> |New Order| P
    P --> |New Order| S
    S --> |Order Solution| P
    P --> |Order Solution| V

 ```
