# Personal Fitness Workspace

Hi, I'm Faith.

I'm building Personal Fitness Workspace because I've experienced how difficult it can be to manage a fitness journey when everything is scattered across different apps.

I might use ChatGPT to think through my fitness goals or create a workout plan, Notes to save it, a separate app to track my workouts, and another tool to manage reminders or meal plans.

Over time, keeping everything connected becomes a challenge. I can have a plan for the week, but real life happens. I miss a workout, move a session to another day, try something spontaneous, or change my goals. Sometimes, the plan no longer reflects what I've actually done.

I wanted one place where my fitness plan and my actual activity could live together — a workspace that remembers my history, helps me stay organised, and adapts as my routine changes.

That idea became **Personal Fitness Workspace**: a personal fitness management workspace designed to bring planning, scheduling, workout logging, meal planning, and progress reviews into one connected experience.

## What I'm building

- **Fitness planning:** Set goals, build routines by hand or ask the built-in assistant for one, and keep control of what gets saved.
- **Workout management:** Create workouts, record what I actually completed, and log spontaneous sessions.
- **Flexible scheduling:** Handle missed and rescheduled workouts without losing the original plan or activity history.
- **Persistent workout history:** Keep past records even when routines and monthly plans change.
- **Meal planning:** Generate meal timetables and shopping lists around my preferences and familiar foods.
- **A connected fitness schedule:** Bring planned workouts, running, and other activities together.
- **Monthly reviews:** Understand what I planned, completed, missed, rescheduled, or did spontaneously, and use that history to inform the next plan.

## What matters to me

I don't want to build another app that generates a plan and leaves me to manage everything else.

I want to build a system that understands the difference between what I intended to do and what actually happened. A system that keeps my history, helps me make better decisions, and gives me the flexibility to adjust without starting over.

The principles guiding this project are simple:

- Plans and completed activities should be recorded separately.
- My fitness history should not disappear when my routine changes.
- AI should make suggestions, but I should remain in control.
- The different parts of my fitness journey should work together.
- The product should adapt to real life rather than assume everything goes according to plan.

## Technology

The project uses **React Native** (Expo) with TypeScript for the app, which runs on the web today. Data stays on the device, the app is hosted on Vercel, and the built-in assistant calls Groq through a small server endpoint so the key is never in the app.

## Project documentation

- [`Product Brief`](docs/PRODUCT_BRIEF.md) — the product vision, problem statement, capabilities, scope, and principles.
- [`Product Specification`](docs/PRODUCT_SPECIFICATION.md) — the detailed workflows, functional requirements, data behaviours, and technical implementation guidance.

This is a personal project shaped by a problem I've experienced. I'm exploring how thoughtful product design and AI can make managing a fitness journey more connected, flexible, and sustainable.
