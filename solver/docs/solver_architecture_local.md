# Solver architecture: local test environment

This is solver_architecture.md with one extra stage on the end. It shows what a
local test environment looks like when the solver runs on its own, with no
Portal and no Visualizer: the packing solution is handed to a local HTTP
display instead of being sent anywhere else on the network.

It is a testing picture only. It is not a proposal for how the three modules
talk to each other in the real system, and it does not replace or compete with
the data flow diagrams in the repository root README, which are the authority on
that. Read solver_architecture.md for the solver's own stages without the test
stand-in attached.

```mermaid
graph TD
    subgraph INPUT["Input Layer"]
        A["Carton Specifications\n(dimensions, max weight)"]
        B["Item Specifications\n(dimensions, type/class)"]
    end

    subgraph GROUPING["Grouping"]
        C["Compatibility Grouper\n(partitions items into packable sets\nbased on type: dangerous goods, fragility)"]
    end

    subgraph PACKING["Optimisation Engine"]
        D["Packing Algorithm\n(selects carton size, applies spatial constraints\n& stacking limits, determines item placement)"]
    end

    subgraph OUTPUT["Output Layer"]
        E["Packing Solution\n(positions, carton assignments)"]
    end
    
    subgraph TESTING["Test: Local Display"]
        F["Local HTTP that receives solver solution output instead of sending to external ports.\n FOR TESTING PURPOSES ONLY"]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
```