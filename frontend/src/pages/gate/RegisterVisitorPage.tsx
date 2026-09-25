/**
 * Route entry for /gate/visitors/new.
 *
 * The screen itself lives in ./VisitorRegistration, split into the wizard
 * steps and the visitor pass. This file stays so the route, its import path
 * and every existing link to it keep working unchanged.
 */
export { VisitorRegistration as RegisterVisitorPage } from './VisitorRegistration/VisitorRegistration';
