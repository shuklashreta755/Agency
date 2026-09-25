import React from 'react';
import FollowUpLeadsList from '../../components/FollowUpLeadsList';

export default function AgentSiteVisits() {
  return (
    <FollowUpLeadsList
      basePath="/agent"
      fixedActivityType="Site Visit"
      title="Site Visits"
      subtitle="Leads with a logged Site Visit activity"
    />
  );
}
