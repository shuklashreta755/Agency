import { createResourceSlice } from './createResourceSlice';

export const projectsResource = createResourceSlice('projects', '/projects');
export const leadsResource = createResourceSlice('leads', '/leads');
export const agentsResource = createResourceSlice('agents', '/agents');
export const meetingsResource = createResourceSlice('meetings', '/meetings');
export const historyResource = createResourceSlice('history', '/history');
