const UNIT_TYPES = [
  'Plot', 'Studio', '1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Penthouse', 'Duplex',
  'Villa', 'Row House', 'Farm House', 'Office', 'Shop', 'Showroom', 'Warehouse', 'Industrial Unit',
];

const UNIT_FEATURES = [
  'Garden Facing', 'Park Facing', 'Pool Facing', 'Road Facing', 'Main Road Facing',
  'Corner Unit', 'East Facing', 'West Facing', 'North Facing', 'South Facing',
  'Near Lift', 'Near Staircase', 'Near Parking', 'Near Clubhouse',
  "Near Children's Play Area", 'Near Gym', 'Near Temple', 'Near School',
];

const UNIT_STATUSES = ['Available', 'Booked', 'Sold', 'On Hold'];

const INSTALLMENT_STATUSES = ['Pending', 'Paid', 'Overdue'];

module.exports = {
  UNIT_TYPES, UNIT_FEATURES, UNIT_STATUSES, INSTALLMENT_STATUSES,
};
