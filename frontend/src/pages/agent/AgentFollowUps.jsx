import React from 'react';
import FollowUpLeadsList from '../../components/FollowUpLeadsList';

export default function AgentFollowUps() {
  return (
    <FollowUpLeadsList
      basePath="/agent"
      title="Follow-ups"
      subtitle="Leads with at least one logged follow-up, sorted by latest activity"
    />
  );
}
