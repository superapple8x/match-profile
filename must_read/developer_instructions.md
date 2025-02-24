# Developer Instructions for Profile Matching Project

## 1. Overview
This file provides guidelines for future developers working on the Profile Matching Application. It outlines what tasks to perform (DOs) and what actions to avoid (DON'Ts).

## 2. Activity Log Requirements
- Activity logs must be created:
  - After work is confirmed complete
  - Before committing any changes
  - As separate files following naming convention: `[YYYY-MM-DDTHH-MM-SS]-[short-work-description].md`
    Example: `2025-02-24T11-23-45-implement-user-auth.md`
  
- Log creation rules:
  - Each developer must create their own activity log files
  - Never modify or overwrite existing activity logs
  - Logs must contain:
    - Complete timestamp with timezone (ISO 8601 format)
    - List of confirmed completed work items
    - Associated files/changes
    - Technical validation steps performed
    - Peer review status (if applicable)

## 3. Best Practices (DOs)
- Follow the project's established guidelines as outlined in "grand_plan.md" and "implementation_steps.md"
- Write clean, modular, and well-documented code
- Ensure comprehensive testing (unit tests, integration tests) accompanies every change
- Log every modification with detailed commit messages and an activity log
- Update documentation regularly when changes are made
- Participate in code reviews and collaborate effectively

## 4. Prohibited Actions (DON'Ts)
- Do not commit incomplete or untested code
- Do not mix unrelated changes in a single commit
- Avoid bypassing code reviews or neglecting proper documentation
- Never remove or alter the activity log or commit history without proper authorization
- Do not overwrite existing activity logs
- Never share or modify another developer's activity logs

## 5. Communication and Change Management
- Discuss major changes with senior developers or the team before implementation
- Use designated communication channels for discussing project modifications
- Update architectural documents (grand_plan.md and implementation_steps.md) if core changes are made

## 6. Additional Guidelines
- Backup data and configuration files before executing major changes
- Test all changes in a staging environment before deploying to production
- Follow security best practices and ensure proper access control
- Adhere to CI/CD protocols and version control best practices

## 7. Conclusion
Adhering to these instructions will ensure that the project remains maintainable, secure, and scalable. Thorough documentation and a consistent activity log are critical for future development and troubleshooting.
