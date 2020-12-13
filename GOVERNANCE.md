# Governance

Since its inception, the Yarn project has been maintained by a set of volunteers from various employers. This document aims to formalize how decisions are made and by whom.

## Code of Conduct

All members must respect the [Code of Conduct](CODE_OF_CONDUCT.md). Grievances can be shared to the email address referenced in this document and will be evaluated per the process described there. See [Moderation](#Moderation) for details.

## Member Roles

### I. Core Contributors

Core Contributors are those with a history of consistent contributions, including but not limited to pull requests, project management, or support. They benefit from a certain amount of privileges, including:

- Push access to the repository, except the `master` / `main` branches
- Contributor role on the Yarn Discord channel
- Ability to vote on project decisions

Being core promoted core contributor doesn't mean the member is required to stay active. Inactive contributors may have voting rights put on hold until they return, but will always retain their status.

#### Induction

Candidates must be privately nominated by an existing core contributors, which will send the proposal to a steward. Stewards will hold a private vote open to any core contributor, and if the proposal passes with a significant majority (75%) the candidate will be reached to be offered the position.

### II. Stewards

Stewards establish the project vision, have a full control over the code and its assets, and assume the right to speak for the project in public. In practical terms, stewards' privileges include:

- Access to the @yarnpkg Twitter account
- Administration privileges on the Yarnpkg GitHub org
- Administration privileges on the Yarnpkg Discord server
- Publish access to the `yarn` npm package (which we don't plan to use much)
- Administration access to the `yarnpkg.com` accounts (Netlify, Cloudflare, ...)
- Ability to veto votes and resolve voting deadlocks
- Define project direction and planning
- Ability to decide on moderation decisions

In the event a steward becomes incapacitated, they are expected to leave keys to a trustee that will transmit the rights to an new steward appointed by the core contributors through a vote.

#### Induction

New stewards will be added based on a unanimous vote by the existing stewards - in the event that one of them is unreachable, the decision will be deferred until all stewards have voted. While discussion and approval will be generally done in private, stewards will hold an advisory poll open to core contributors.

## Current Members

### Stewards

- Maël Nison - [arcanis](https://github.com/arcanis)

### Core Contributors

- Bram Gotink - [bgotink](https://github.com/bgotink)
- Daniel Almaguer - [deini](https://github.com/deini)
- Haroen Viaene - [haroenv](https://github.com/haroenv)
- Kristoffer K. - [merceyz](https://github.com/merceyz)
- Marc-Antoine - [embraser01](https://github.com/embraser01)
- Paul Soporan - [paul-soporan](https://github.com/paul-soporan)
- Sebastian Silbermann - [eps1lon](https://github.com/eps1lon)
- Victor Vlasenko - [larixer](https://github.com/larixer)
- Will Griffiths - [willgriffiths](https://github.com/willgriffiths)

## Project direction and planning

Project direction and planning is a shared responsibility amongst members. Stewards are responsible for defining high level goals and scope of the project that should be adhered to.

## Voting

Certain project decisions require a vote. These include:

- **Governance changes:** simple majority (over 50%), conducted via GitHub PR approval.

- **Core contributor membership:** overwhelming majority (over 75%) conducted by privately messaging a steward. Funneling both assenting and dissenting votes directly through stewards allows for anonymity when discussing the merits of a potential contributor.

A steward may initiate a vote for any unlisted project decision. Core contributors can request a vote by contacting a steward.

### Rules

- Members may abstain from a vote.
- Members who do not vote within 7 days will automatically abstain.
- Stewards may reduce the 7 day automatic abstain for urgent decisions.
- Stewards reserve the right to veto approval with a publicly disclosed reason.

## Moderation

Outlined below is the process for Code of Conduct violation reviews.

### Reporting

Anyone may report a violation. Violations can be reported in the following ways:

- In private, via email to one or more stewards
- In private, via direct message to a project steward on Discord
- In public, via a GitHub comment (mentioning one of the stewards)
- In public, via the project Discord server

### Who gets involved?

Each report will be assigned reviewers. These will initially be all project stewards. In the event of any conflict of interest - ie. stewards who are personally connected to a situation, they must immediately recuse themselves.

At request of the reporter and if deemed appropriate by the reviewers, another neutral third-party may be involved in the review and decision process.

### Review

If a report doesn’t contain enough information, the reviewers will strive to obtain all relevant data before acting.

The reviewers will then review the incident and determine, to the best of their ability:

- What happened,
- Whether this event constitutes a Code of Conduct violation,
- Who, if anyone, was involved in the violation,
- Whether this is an ongoing situation.

The reviewers should aim to have a resolution agreed very rapidly; if not agreed within a week, they will inform the parties of the planned date.

### Resolution

Responses will be determined by the reviewers on the basis of the information gathered and of the potential consequences. It may include:

- Taking no further action,
- Issuing a reprimand (private or public),
- Asking for an apology (private or public),
- Permanent ban from the GitHub org and Discord server,
- Revoked contributor status.

## Fund Allocation

Funds will be allocated for project-specific services such as domain registration and website hosting. Other usage of funds has yet to be decided.

Expenses will be approved by project stewards.
