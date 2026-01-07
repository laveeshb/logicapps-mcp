Adds tools to clone Consumption Logic Apps to Standard Logic Apps using the official Logic Apps clone API.

## New Tools
- `clone_workflow` - Clone a Consumption workflow to a Standard Logic App
- `validate_clone_workflow` - Validate compatibility before cloning

## Implementation
- Calls official `POST /workflows/{name}/clone` and `/validateClone` ARM APIs
- No manual VFS or definition manipulation - the service handles everything

## Testing
- Unit tests (10 tests) - verify correct API calls and request bodies
- Integration tests (6 tests) - real Azure calls that created actual workflows

## Documentation
- Updated docs/TOOLS.md with new tools
- Updated knowledge/reference/tool-catalog.md
- Created knowledge/operations/clone.md referencing official Microsoft docs

## Notes
- Clone only works Consumption -> Standard (not reverse)
- Target Standard Logic App must already exist
- API connections require reconfiguration after cloning
