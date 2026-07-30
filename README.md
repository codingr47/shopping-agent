# POC Shopping Agent


## Project Overview
This project is a Proof-Of-Concept chat application and an agentic system powered by LangGraph (by LangChain) Powering the application.  In this app, the user is able to talk conversationally with an AI Assistant ang get a partial e-commerce
experience through chat. 
In Scope:
Browsing product categories, Searching for products, Viewing Specific products, etc'
Out of Scope:
Checkout, Payment


### Setup And Run Instructions

To run the entire suite (server and backend)
Follow these steps:

1. In your terminal / command line, cd to the project root
2. run ``npm install``
3. run ``npm run dev``


To run the evaluation suite (Automated evaluation tests), run this command ``npm run test`` in the project's root cwd

## Architecture & Framework Choice

### Chat Service
For the chat service I decided to use LangGraph. The reasons behind using LangGraph:
- Stateful, good for agentic systems that need to separate conversation data from other data such as products / categories
- Easily defines multi step complex workflows, without creating bloated files with bloated logic
- I just personally really like working with this sort of structure (its a also a matter of personal flavor...)
Before choosing LangGraph, I explored two alternatives: 
- Vercel AI SDK
- Mastra

Vercel AI SDK seemed like a solid option but the downside was that its too plug and play and generally optimized for websites, and less for services and I wanted a service in between.
Mastra is also a solid option but: I never worked with it and its very new, less universal than LangChain or LangGraph.

#### Chat Service Graph Architecture Diagram Simplified
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                          USER REQUEST                          │
│                                                                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Guardrail Classifier  │  ← Checks if in-scope/out-of-scope
        │  Extracts intents      │     Extracts intent & slots
        └─────┬──────────────────┘
              │
              ├─── Out of Scope ─────────────┐
              │                              │
              └─── In Scope ─────┐           │
                                 ▼           │
                        ┌─────────────────┐  │
                        │   Supervisor    │  │
                        │ Routes to nodes │  │
                        └────────┬────────┘  │
                                 │           │
            ┌────────────┬────────┴────┬─────┴──────────────┐
            │            │             │                    │
            ▼            ▼             ▼                    ▼
      ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐
      │ Search  │ │Comparison│ │ Summarize │ │   Off Topic      │
      │Explorer │ │   Node   │ │   Node    │ │   Responder      │
      └────┬────┘ └────┬─────┘ └─────┬─────┘ └────────┬─────────┘
           │           │             │                 │
           └───────┬───┴─────────────┴────────────────┴────────┘
                   │
                   ▼ (final message)
        ┌────────────────────────┐
        │     RESPONSE TO USER   │
        └────────────────────────┘
```

### Chat UI

I used assistant-ui. I didn't go into searching alternatives, because I found it good enough. and I didn't want to invent the wheel. especially because its quite rich in features already.

## Retrieval strategy

The retrieval system was designed as a multi step solution with an intent layer and an execution layer
both layers are fully LLM driven.
The intent classification layer (Guardrail Classifier) Has two functions ->
1. Decide if the request is in scope or out of scope (guardrails)
2. Extract the appropriate intents of the user in terms of business logic
3. Dispatch each intent with a search exploration expert which will translate the business logic layer into actionable tool calls with regards to the API layer that is being discovered through an MCP Server (Could be easily changed into another API or another MCP Server)
The idea is two separate these two concerns and attempt to decouple the Business Logic of the experience and the actual tool calling strategy.

How does the system behave on ambiguous queries?
Unfortunately, these sort of prompts are not part of the reinforcement work that was done at this point. so the system will most likely behave in alignment with the model that is being used. in my manual testings, the system was able to understand for 'something cheap and cool' that the user wants to browse products that are cheap, and was able to sort them in ascending order -> cheaper products appear first.

However, for out of domain queries like 'a flight to Tokyo' or 'What is the meaning of life' the system will respond with a rejection, as expected - the guardrails are there.


## Conversation State

Persistence live inside an SQL Lite DB (local file). I chose it because its a middle ground between In Memory - Database Service
If I would choose In Memory, my conversations won't live a server restart. 
If I would include a Database Service, I would have introduced unnecessary dependencies for this project (its just a POC)
The conversation itself is always being sent to an LLM with respect to the maximal context window (in tokens) defined
as configuration for this service. if storage is full on the disk, thats a whole different story.
What happens if the user clears it mid conversation? he has no option of doing it through the UI.

## Evaluation
The evaluation suite contains an offline dataset of 25 prompts.
When finished running, it will generate an html report which is user readable, containing graphs and insights. 
Latest report [here](./report_1785435830438.html)

It verifies the following things, end to end:
- What journey did the user go through in the graph for a given prompt (which nodes, and which tool calls were made)
- What tool calls were made, with which arguments
- Verifies forbidden tool calls were not made for a given prompt

For each prompt, the evaluation suite will evaluate a configurable amount of time in attempt to calculate a mean average of evaluation for a given prompt.

The evaluation suite will most probably catch any changes made to the business logic itself or to the API schema level.
What would slip through are things that are not handled - 25 prompts for a production system is not enough.

## Known limitations

- The evaluation suite dataset is not big enough, it needs a lot more examples to be production ready
- Traceability could be better, for production I would use LangSmith so I can trace and address problems in real time.
- The system doesn't handle ambiguity enough. 
- The evaluation suite doesn't handle multi prompts, which I would add if I had more time to do so.
- The evaluation suite indicates the system, for some prompts add unnecessary tool arguments. not a blocker because these are defaults mostly and not something that is breaking the user from using it. but I would spend more time making the instructions better on that specific subject.
