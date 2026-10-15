# Build tools and hosted runtime

Vercel runs `npm run build` with development dependencies installed. The hosted
renderer imports `dist/server/index.js` through `api/render.mjs`; it does not run
the Vinext CLI or import the Vinext npm package. Vinext is therefore a development
dependency, like Vite, Wrangler, and the build plugins. Its version is unchanged.

The optimized build records its external packages in
`dist/server/vinext-externals.json`. The account-import validation build reports
an empty list and contains no `braces`, `micromatch`, `fast-glob`, or dynamic-import
plugin package references. The actual renderer is also checked with a Node loader
that refuses imports from the Vinext npm package.

The unpatched [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
still applies to the development toolchain. Moving build tooling does not patch
that package. Build only trusted repository code and patterns; review upstream
fixes when available. The production dependency audit remains enabled without
an advisory allowlist or severity reduction.

Compatible patch releases of `fast-uri` and `source-map-js` are recorded in the
lockfile. No authentication, database, framework version, or deployment settings
are replaced for this dependency correction.
