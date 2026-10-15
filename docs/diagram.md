---

  ``` mermaid
 ---
 title: New UPDATED Proposal of data flows (Sprint 2)
 ---
 flowchart
    S((Solver))
    P((Portal))
    V((Visualizer))
    I@{shape: cloud, label: Internet}

    I --> |New Order| P
    P --> |New Order| S
    S --> |Order Solution Main| V
    V --> |Order Solution Main| P

 ```