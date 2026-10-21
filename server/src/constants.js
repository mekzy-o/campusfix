/** Domain constants shared across the API. */

const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  STAFF: 'STAFF',
  OFFICER: 'OFFICER',
  ADMIN: 'ADMIN',
});

/** Roles that submit service requests (the "Student/Staff" dashboard). */
const REQUESTER_ROLES = [ROLES.STUDENT, ROLES.STAFF];

const STATUSES = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/** Statuses after which a request can no longer be worked on. */
const FINAL_STATUSES = [STATUSES.CLOSED, STATUSES.CANCELLED];

/**
 * Allowed status transitions per actor. A transition not listed here is
 * rejected with HTTP 409, which keeps the workflow consistent no matter
 * which client calls the API.
 */
const TRANSITIONS = {
  REQUESTER: {
    PENDING: ['CANCELLED'],
    COMPLETED: ['CLOSED', 'IN_PROGRESS'], // confirm & close, or reopen
  },
  OFFICER: {
    ASSIGNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['ON_HOLD', 'COMPLETED'],
    ON_HOLD: ['IN_PROGRESS'],
  },
  ADMIN: {
    PENDING: ['REJECTED', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: ['CLOSED', 'IN_PROGRESS'],
    REJECTED: ['PENDING'],
    CLOSED: [],
    CANCELLED: [],
  },
};

module.exports = {
  ROLES, REQUESTER_ROLES, STATUSES, PRIORITIES, FINAL_STATUSES, TRANSITIONS,
};
