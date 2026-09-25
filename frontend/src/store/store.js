import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import trackingReducer from "./trackingSlice";
import reportsReducer from "./reportsSlice";
import followUpsReducer from "./followUpsSlice";
import {
  projectsResource,
  leadsResource,
  agentsResource,
  meetingsResource,
  historyResource,
} from "./resources";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tracking: trackingReducer,
    reports: reportsReducer,
    followUps: followUpsReducer,
    projects: projectsResource.slice.reducer,
    leads: leadsResource.slice.reducer,
    agents: agentsResource.slice.reducer,
    meetings: meetingsResource.slice.reducer,
    history: historyResource.slice.reducer,
  },
});

export default store;
