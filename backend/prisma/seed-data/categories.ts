/**
 * Initial category tree — PRD Appendix A. `sensitive` categories are hidden until
 * government-ID verification exists (FR-104, ADR-010).
 * To change categories: edit here AND PRD Appendix A, then run `npm run db:seed`.
 */
export interface CategorySeed {
  slug: string;
  name: string;
  groupName: string;
  sensitive?: boolean;
}

const group = (groupName: string, items: Array<[slug: string, name: string]>, sensitive = false) =>
  items.map(([slug, name]): CategorySeed => ({ slug, name, groupName, sensitive }));

export const CATEGORY_SEED: CategorySeed[] = [
  ...group('Home services', [
    ['cleaning', 'Cleaning'],
    ['painting', 'Painting'],
    ['plumbing', 'Plumbing'],
    ['electrical', 'Electrical'],
    ['carpentry', 'Carpentry'],
    ['pest-control', 'Pest control'],
    ['shifting-help', 'Shifting help'],
  ]),
  ...group('Repairs', [
    ['bike-mechanic', 'Bike mechanic'],
    ['car-mechanic', 'Car mechanic'],
    ['appliance-repair', 'Appliance repair'],
    ['device-repair', 'Mobile / laptop repair'],
  ]),
  ...group('Food', [
    ['home-chef', 'Home chef'],
    ['tiffin-service', 'Tiffin service'],
    ['catering', 'Catering'],
    ['baking', 'Baking'],
  ]),
  ...group('Events', [
    ['decoration', 'Decoration'],
    ['photography', 'Photography'],
    ['videography', 'Videography'],
    ['catering-staff', 'Catering staff'],
    ['dj-music', 'DJ / Music'],
  ]),
  ...group('Tech', [
    ['web-development', 'Web development'],
    ['app-development', 'App development'],
    ['it-support', 'IT support'],
    ['data-excel', 'Data / Excel work'],
  ]),
  ...group('Creative', [
    ['graphic-design', 'Graphic design'],
    ['video-editing', 'Video editing'],
    ['content-writing', 'Content writing'],
    ['social-media', 'Social media'],
  ]),
  ...group('Education', [
    ['tutoring', 'Tutoring'],
    ['music-lessons', 'Music lessons'],
    ['coding-lessons', 'Coding lessons'],
    ['language-lessons', 'Language lessons'],
  ]),
  ...group('Driving & delivery', [
    ['personal-driver', 'Personal driver'],
    ['delivery-pickup', 'Delivery / pickup'],
  ]),
  ...group('Personal', [
    ['fitness-trainer', 'Fitness trainer'],
    ['beautician', 'Beautician'],
    ['tailoring', 'Tailoring'],
    ['mehendi', 'Mehendi'],
  ]),
  ...group(
    'Care',
    [
      ['babysitting', 'Babysitting'],
      ['elder-care', 'Elder care'],
      ['pet-care', 'Pet care'],
    ],
    true,
  ),
  ...group('Other', [['other', 'Other']]),
];
