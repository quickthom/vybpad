---
project: vYbpad
developer: vYb Agency
date: 4/12/2026
---

# **vYbpad** — REQUIREMENTS SPECIFICATION

## BASIC INFO
* **Project**: vYbpad (Initial Version)
* **Developer**: vYb Agency
* **Date**: 4/12/2026

## PROJECT DESCRIPTION
This project is to create a product that clones of much of the functionality of the web application Hookpad. Success would mean a Hookpad user could switch to vYbpad and feel no loss of functionality for most workflows, but we aren't aiming to implement every single feature just yet.

## ACCEPTANCE REQUIREMENTS

The acceptance requirements will have been satisfied when vYb Agency delivers a product which:

1. replicates all of the functionality of Hookpad, subject to the **exceptions** below and within the tolerance of the **research requirements** below.
2. is securely deployed and accessible over the internet
3. has had all features thoroughly tested according to the testing standard (see below)
4. has an appealing, attractive, and aesthetically consistent UI that maintains the  basic structure and workflow of Hookpad.
5. has no major bugs or missing features
6. provides a frictionless way to export melody compositions to StudioOne, including optionally updating S1's chord track to the vYbpad chords. Wrapping the app in a VST plugin would be an accepted solution, but not a necessary one.

### **EXCEPTIONS**
The following exceptions apply to the acceptance requirements:

- Hookpad has a rich system for arranging backing tracks. For this project, Hookpad's default behavior is sufficent: during playback, the default backing track is a piano playing chords in a neutral style. That's all that will be required for this release.
- Hookpad has some new AI features that incur an additional subscription cost. You may ignore that part of it entirely.
- Only the core Hookpad app is part of this requirement. Things like login screens, account management, etc. do not need to be replicated. However, the team *should* implement a robust auth framework.
- You may find that there are features that are either impossible to implement or which you cannot obtain enough information about to confidently replicate. The HITL (User) should be notified whenever one of these is identified, but no response or approval is needed to move forward with the rest of the project.

## TESTING STANDARD

Before acceptance, the product must be **fully** tested, to the best of the team's ability. 

That includes front-end/client-side code and UI/UX elements. It's not enough to just test component prop signatures, the team must test the actual DOM elements and user flows, and must demonstrate it by writing unit tests. If the notes are supposed to be highlighted during playback, the team must verify that however they can.

**The standard**: On delivery, it is expected that a typical user engaged in an ordinary session with the tool, in which no unusual situations or edge cases are relevant, will encounter **zero** bugs and that all features will work as expected.

*Final acceptance is contingent on meeting this standard.*

## RESEARCH REQUIREMENTS

The team is expected to make a good-faith effort to learn as much about Hookpad as is feasible in order to accurately replicate it. There are many sources that could prove valuable--feature lists, changelogs, screenshots, user reports, client-side code from the actual site--and the team is expected to do its due diligence in the research phase.

On delivery, any feature that is omitted entirely must either have been reported to the HITL when it was identified as infeasible or unknowable, **or** be absent from every source the team could reasonably have consulted. If well-documented features are omitted without prior HITL notification, the product will not be accepted.

## RESOURCES

### BLANKET WEB ACCESS & INSTALLATION PERMISSION
The team is welcome to use any web resources they like and to install whatever software is needed to get the work done. If the team's leadership wishes to place stricter controls on package installation or web access for some of its members, it may do so, but the HITL does not need to be consulted before using this blanket installation authority.

### BE MINDFUL OF COSTS
The real resources to worry about are time and tokens. Please be mindful of how much the team uses of both.