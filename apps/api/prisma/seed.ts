import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Create roles
  const [adminRole, analystRole, approverRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Full platform access' },
    }),
    prisma.role.upsert({
      where: { name: 'ANALYST' },
      update: {},
      create: { name: 'ANALYST', description: 'Analyze BRDs and manage requirements' },
    }),
    prisma.role.upsert({
      where: { name: 'APPROVER' },
      update: {},
      create: { name: 'APPROVER', description: 'Review and approve requirement baselines' },
    }),
  ]);

  console.log('Roles created:', [adminRole.name, analystRole.name, approverRole.name]);

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: 'brd-platform' },
    update: {},
    create: { name: 'BRD Platform', slug: 'brd-platform' },
  });

  console.log('Organization created:', org.name);

  // Create admin user (dev seed password: admin123)
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brd.local' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@brd.local',
      name: 'Admin',
      passwordHash: adminPasswordHash,
      organizationId: org.id,
      roleId: adminRole.id,
    },
  });

  console.log('Admin user created:', admin.email);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
