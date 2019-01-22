---
id: enterprise-practices
title: Enterprise Practices
sidebar_label: Enterprise Practices
---

Yarn has originally been designed by Facebook, Google, and Expo. As such, a
good chunk of its features have been made specifically to fill the
high-reliability, low-friction needs that companies of any size encouter. Since
it might sometimes be hard to figure out what the best practices are, the
following document is a guide on what we think are sensible setups for
enterprise users.

## Make a policy against packages with build scripts

> Note: For obvious reasons, this particular recommendation mostly applies to
> interpreted languages rather than compiled ones.

**Why?** Build scripts cause a bunch of problems in the context of a package
manager, are a vulnerability risk, and have portability issues.

**How?** Apart from avoiding packages that have build scripts, you also can
disable those build scripts if they don't offer sensible benefits. This can be
done either globally through configuration (`enable-scripts`), or on a
per-package basis through the `dependenciesMeta` field.

## Add your cache to your repository

**Why?** By using a checked-in cache you shield yourself against problems that
wouldn't be actionable otherwise (the most significant one being an unavailable
registry). You also benefit from faster installs, and only are one step away
from [Zero-Installs]().

**How?** Simply remove `.berry` from your `.gitignore` and add all the files
into your repository. It might look at lot (it really isn't, and Git is able to
take advantage of the cache being comprised of binary files), but consider what
your priorities are: repository size, or faster development and painless
release cycles? 😉

## Force your team to use the exact same Yarn release

**Why?** While we do our best to follow semver and ensure backward and forward
compatibility in the same minor branch, sometimes things might slip up without
us noticing them. It can be frustrating when it happens, and lead to hard to
debug issues ("works on my machine"). Enforcing a single version across your
team is a simple way to ensure that everyone has access to the same features.

**How?** Simply run `yarn policies set-version latest`, and Yarn will download
and store the latest binary available in your repository (you might have to
remove `.berry/releases` from your `.gitignore`). It will also update your
configuration so that even when using the global Yarn from your system, it
will correctly pick up the local one.
