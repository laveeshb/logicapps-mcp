Fixes #58

## Problem
`clearCache()` used unsafe non-null assertion (`resourceGroupName!`) that could cause runtime error if `logicAppName` is provided but `resourceGroupName` is undefined.

## Solution
- Added validation: throw clear error if `logicAppName` is provided without `resourceGroupName`
- Replaced `!` assertion with `?? ""` for null coalescing
