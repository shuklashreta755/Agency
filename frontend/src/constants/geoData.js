// Country -> State -> Cities, used by the Add Lead form's "Preferred Locations"
// field. Not exhaustive — covers the most common markets. "Other" is always
// available at every level so a country/state/city that isn't listed can still
// be typed in by hand.

export const COUNTRIES = ['India', 'United States', 'United Arab Emirates', 'Other'];

export const STATES_BY_COUNTRY = {
  India: [
    'Maharashtra', 'Karnataka', 'Delhi', 'Gujarat', 'Telangana', 'Tamil Nadu',
    'West Bengal', 'Rajasthan', 'Uttar Pradesh', 'Punjab', 'Kerala', 'Madhya Pradesh', 'Other',
  ],
  'United States': ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Other'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Other'],
  Other: ['Other'],
};

export const CITIES_BY_STATE = {
  Maharashtra: ['Mumbai', 'Pune', 'Navi Mumbai', 'Thane', 'Nagpur', 'Nashik', 'Lonavala', 'Aurangabad', 'Kolhapur', 'Solapur'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Davanagere', 'Ballari', 'Shivamogga', 'Tumakuru', 'Udupi'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Saket', 'Karol Bagh', 'Pitampura', 'Janakpuri', 'Vasant Kunj', 'Lajpat Nagar', 'Connaught Place'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh', 'Anand', 'Nadiad'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Secunderabad', 'Ramagundam', 'Mahbubnagar', 'Nalgonda', 'Adilabad'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur', 'Kharagpur', 'Haldia'],
  Rajasthan: ['Jaipur', 'Udaipur', 'Jodhpur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar', 'Bhilwara', 'Sikar', 'Pali'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Ghaziabad', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh'],
  Punjab: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Pathankot', 'Moga'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha', 'Palakkad', 'Malappuram', 'Kottayam'],
  // Top 10 cities for Madhya Pradesh — Indore included as requested.
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa'],
  California: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
  'New York': ['New York City', 'Buffalo', 'Albany'],
  Texas: ['Houston', 'Austin', 'Dallas', 'San Antonio'],
  Florida: ['Miami', 'Orlando', 'Tampa'],
  Illinois: ['Chicago', 'Naperville'],
  Dubai: ['Dubai Marina', 'Downtown Dubai', 'Business Bay', 'Jumeirah'],
  'Abu Dhabi': ['Al Reem Island', 'Saadiyat Island', 'Yas Island'],
  Sharjah: ['Al Nahda', 'Al Majaz'],
  Ajman: ['Al Nuaimiya', 'Al Rashidiya'],
};
