# UrbanFlow AI: Traffic Sim Security Spec

## Data Invariants
1. Simulation documents must have a valid name and status.
2. Traffic lights must belong to a parent simulation and have valid states (RED, YELLOW, GREEN).
3. Vehicles must have coordinate bounds matching the simulation area.
4. Only authenticated users can create simulations.
5. Only the creator (owner) of a simulation can modify its configuration or delete it.

## The Dirty Dozen (Attack Vectors)
1. **Simulation Hijack**: User B tries to change the owner of User A's simulation.
2. **Infinite Spawn**: Malicious update to `spawnRate` set to 10^9.
3. **Invalid Light State**: Setting traffic light to "PURPLE".
4. **Ghost Vehicles**: Creating vehicles with coordinates outside simulation bounds.
5. **PII Injection**: Adding "email" field to Simulation document (not in schema).
6. **State Shortcut**: Changing simulation status from 'paused' to 'active' without being the owner.
7. **Simulation Bombing**: Creating 10,000 simulations per second (Rate limiting).
8. **ID Poisoning**: Using a 1MB string as a simulation ID.
9. **Orphaned Traffic Light**: Creating a traffic light for a non-existent simulation.
10. **Timestamp Spoofing**: Setting `updatedAt` to a future date.
11. **Shadow Field Injection**: Adding `isAdmin: true` to a vehicle document.
12. **Negative Speed**: Setting vehicle speed to -100.

## Test Runner (firestore.rules.test.ts)
```typescript
// Test implementation template
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// ... (Simulated tests for the Dirty Dozen)
```
