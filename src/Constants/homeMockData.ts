export const HOME_USER = {
  name: 'Neelesh Kanade',
  initials: 'NK',
};

export const WALLET_STATIC = {
  balanceLabel: '₹4,580',
  availableBalance: 'Available Balance',
  registrations: 120,
  registrationsLabel: 'Registrations',
  testsCompleted: 75,
  testsCompletedLabel: 'Tests Completed',
};

export type UpcomingTestItem = {
  patientName: string;
  patientId: string;
  testName: string;
  time: string;
  payment: string;
};

export const UPCOMING_TESTS: UpcomingTestItem[] = [
  {
    patientName: 'Ramesh Patil',
    patientId: 'P10234',
    testName: "Men's Heart Screening",
    time: '10:30 AM',
    payment: 'Paid',
  },
  {
    patientName: 'Ramesh Patil',
    patientId: 'B42D53338F',
    testName: "Men's Heart Screening",
    time: '10:30 AM',
    payment: 'Paid',
  },
];

export type CompletedTestItem = {
  patientName: string;
  patientId: string;
  testName: string;
  location: "At Patient's Home" | 'At Centre';
};

export const COMPLETED_TESTS: CompletedTestItem[] = [
  {
    patientName: 'Ramesh Patil',
    patientId: 'B42D53338F',
    testName: "Men's Heart Screening",
    location: "At Patient's Home",
  },
  {
    patientName: 'Ramesh Patil',
    patientId: 'P10234',
    testName: "Men's Heart Screening",
    location: 'At Centre',
  },
];

export type HomeVisitTestItem = {
  patientName: string;
  patientId: string;
  testName: string;
  location: string;
  time: string;
  payment: string;
};

export const HOME_VISIT_TESTS: HomeVisitTestItem[] = [
  {
    patientName: 'Ramesh Patil',
    patientId: 'B42D53338F',
    testName: "Men's Heart Screening",
    location: 'Hadapsar, Pune',
    time: '20 Mar, 10 AM',
    payment: 'Paid',
  },
  {
    patientName: 'Ramesh Patil',
    patientId: 'P10234',
    testName: "Men's Heart Screening",
    location: 'Hadapsar, Pune',
    time: '10:30 AM',
    payment: 'Paid',
  },
];

/** Hero banner (`/background-images/:id`) */
export const BACKGROUND_IMAGE_API_ID = 3;

/** My Wallet illustration (`/background-images/:id`, CMS title `wallet`) */
export const WALLET_BACKGROUND_IMAGE_API_ID = 5;
