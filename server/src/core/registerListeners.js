import { onEvent } from './events.js';
import { createDispatchForProject } from '../modules/dispatches/dispatches.service.js';
import { prisma } from './prisma.js';

export function registerListeners() {
  onEvent('project.confirmed', async ({ projectId }) => {
    await createDispatchForProject(projectId);
  });
  onEvent('dispatch.delivered', async ({ projectId }) => {
    await prisma.project.updateMany({ where: { id: projectId, status: 'DELIVERED' }, data: { status: 'DELIVERED' } });
  });
}
