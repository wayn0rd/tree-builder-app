// HTTP routes for Convex Auth (OAuth callback endpoints etc.) — spec F8.
import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
