/**
 * Resource Categories — static constant list.
 * No database table needed; served directly from this file via GET /resource-categories.
 * To add or rename a category, update this file and redeploy.
 */

export const RESOURCE_CATEGORIES = [
    {
        name: 'Hardware',
        description: 'Laptops, monitors, phones, keyboards, mice, webcams, headsets, tablets',
    },
    {
        name: 'Hardware Repair',
        description: 'Repairs and servicing of existing equipment (laptop fix, screen replacement, battery swap)',
    },
    {
        name: 'Software & Subscriptions',
        description: 'SaaS tools, licences, IDE plugins, antivirus, design tools, productivity apps',
    },
    {
        name: 'Furniture & Ergonomics',
        description: 'Standing desks, ergonomic chairs, footrests, monitor arms, wrist rests',
    },
    {
        name: 'Connectivity',
        description: 'Internet reimbursement, WiFi routers, SIM cards, VPN hardware',
    },
    {
        name: 'Stationery & Supplies',
        description: 'Notebooks, pens, sticky notes, printer cartridges, desk supplies',
    },
    {
        name: 'Training & Learning',
        description: 'Online courses, books, certifications, conference tickets, workshop fees',
    },
    {
        name: 'Staffing',
        description: 'New headcount and team allocation requests',
    },
    {
        name: 'Access & Accounts',
        description: 'VPN access, internal tool accounts, cloud platform seats (AWS, GCP, Azure)',
    },
    {
        name: 'Workspace',
        description: 'Coworking space memberships, parking passes, lockers',
    },
    {
        name: 'Other',
        description: 'Anything not covered by the categories above — please describe in detail',
    },
] as const;

export type ResourceCategoryName = typeof RESOURCE_CATEGORIES[number]['name'];

export const RESOURCE_CATEGORY_NAMES: ResourceCategoryName[] = RESOURCE_CATEGORIES.map(
    (c) => c.name,
) as ResourceCategoryName[];
