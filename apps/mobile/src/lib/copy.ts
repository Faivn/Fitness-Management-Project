/**
 * All shared UX copy in one place, so terms stay consistent. Short labels,
 * action-first buttons, one idea per sentence. Screen-specific strings that are
 * used once stay next to their screen.
 */
export const copy = {
  brand: { name: 'Mova', tagline: 'Plan. Train. Review.' },
  demo: {
    note: 'Demo · saved on this device',
    storageNote: 'Everything you add is saved in this browser only.',
    resetTitle: 'Demo data',
    resetAction: 'Reset demo data',
    resetConfirm: 'Replace everything with the original demo data?',
  },
  actions: {
    open: 'Open demo',
    save: 'Save',
    saveContinue: 'Save and continue',
    skip: 'Skip',
    cancel: 'Cancel',
    confirm: 'Confirm',
    approve: 'Approve',
    reject: 'Reject',
    retry: 'Try again',
    seeAll: 'See all',
    add: 'Add',
    remove: 'Remove',
  },
  ai: {
    name: 'Mova companion',
    disclaimer: 'The assistant can make mistakes. Tick a suggestion to save it.',
    placeholder: 'Message Mova',
    emptyTitle: 'Ask Mova',
    emptyBody: 'Goals, routines or meals.',
    starters: ['Suggest a goal for strength', 'Plan my training week', 'Plan my meals'],
    thinking: 'Thinking',
    draftLabel: 'Draft · not saved',
    draftRoutine: 'Draft a routine',
    draftMeals: 'Draft a meal plan',
    reviewRoutine: 'Review routine',
    reviewMeals: 'Review meal plan',
  },
  empty: {
    routines: 'No routines yet.',
    nothingScheduled: 'Nothing scheduled.',
    noMealPlan: 'No meal plan. Ask the companion to draft one.',
    noReviews: 'No reviews yet.',
  },
} as const;
