---
config:
  layout: dagre
---
flowchart LR
 subgraph Sources[":: External APIs ::"]
    direction TB
        API_P["PANGAEA"]
        API_G["GBIF"]
        API_O["OpenAlex"]
        API_S["STAC / EO"]
  end
 subgraph Impl["Implementations"]
        A_P["PangaeaAdapter"]
        A_G["GbifAdapter"]
        A_O["OpenAlexAdapter"]
        A_S["StacAdapter"]
  end
 subgraph ACL[":: Anti-Corruption Layer ::"]
    direction TB
        I_Adpt{{"IDataAdapter"}}
        Impl
  end
 subgraph Services["Business Logic"]
        S_Data["DatasetService"]
        S_Key["KeywordService"]
        S_Auth["AuthorService"]
  end
 subgraph Kernel[":: Core Domain ::"]
    direction TB
        Reg["AdapterRegistry"]
        Services
        Cache[("Redis Cache")]
  end
 subgraph Transformers["View Models"]
        T_Geo["Geo Transform"]
        T_Time["Time Transform"]
        T_Chord["Chord Transform"]
  end
 subgraph BFF[":: BFF / Presentation ::"]
    direction TB
        Transformers
        API_Gate[/"REST Routes"/]
  end
 subgraph Client[":: React Frontend ::"]
        FE_RTK["RTK Query"]
        FE_Store["Redux Store"]
        FE_Viz["amCharts"]
  end
    API_P -.-> A_P
    API_G -.-> A_G
    API_O -.-> A_O
    API_S -.-> A_S
    I_Adpt -.- Impl
    A_P ==> Reg
    A_G ==> Reg
    A_O ==> Reg
    A_S ==> Reg
    Reg ==> S_Data & S_Key & S_Auth
    Services <==> Cache
    S_Data --> T_Geo & T_Time
    S_Key --> T_Chord
    S_Auth --> T_Chord
    Transformers --> API_Gate
    API_Gate == JSON ==> FE_RTK
    FE_RTK --> FE_Store
    FE_Store --> FE_Viz

     API_P:::source
     API_G:::source
     API_O:::source
     API_S:::source
     A_P:::adapter
     A_G:::adapter
     A_O:::adapter
     A_S:::adapter
     I_Adpt:::adapter
     S_Data:::core
     S_Key:::core
     S_Auth:::core
     Reg:::core
     Cache:::storage
     T_Geo:::bff
     T_Time:::bff
     T_Chord:::bff
     API_Gate:::bff
     FE_RTK:::ui
     FE_Store:::ui
     FE_Viz:::ui
    classDef source fill:#f5f5f5,stroke:#bdbdbd,stroke-dasharray:5 5,color:#616161,rx:5,ry:5
    classDef adapter fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#e65100,rx:5,ry:5
    classDef core fill:#e3f2fd,stroke:#2196f3,stroke-width:2px,color:#0d47a1,rx:5,ry:5
    classDef storage fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#4a148c,shape:cylinder
    classDef bff fill:#e8f5e9,stroke:#4caf50,stroke-width:2px,color:#1b5e20,rx:5,ry:5
    classDef ui fill:#263238,stroke:#000,stroke-width:2px,color:#fff,rx:10,ry:10