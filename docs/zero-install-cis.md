---
id: zero-install-cis
title: Zero-Install CIs
sidebar_label: Zero-Install CIs
---

One of the explicit goals in Berry is to make it extremely easy to setup a
project where your dependencies *don't need to be installed*. This is
particularly important for production-grade applications, since any code
running is a code that might fail. The less setup layers are needed, better it
is.

The way Berry achieves this effect is through its cache system and PnP
integration. When the PnP file is generated, the paths it contains directly
link to the compressed cache archives. Then at runtime Node is made aware of
what cache archives are, and how to access files directly from them. This
pattern isn't unique to Node: PHP projects use a similar one with
[phar archives](http://php.net/manual/en/phar.using.intro.php).

## How to use

1. Remove the `.berry` and `.pnp.js` files from your `.gitignore`
2. Add them to your repository
3. Remove `yarn install` from your setup (CI, ...)
4. That's it, you're done!

The initial push will take a bit more time (Git will need to send the tarballs
over the wire into your remote repository), but starting from now on you'll
never need to run `yarn install` anymore. Not even when switching branches.
