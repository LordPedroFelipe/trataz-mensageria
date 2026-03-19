import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CriarMessageDispatchAudit20260318212000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'MessageDispatchAudit',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment'
          },
          {
            name: 'entityType',
            type: 'varchar',
            length: '32'
          },
          {
            name: 'entityId',
            type: 'varchar',
            length: '64'
          },
          {
            name: 'notificationType',
            type: 'varchar',
            length: '64'
          },
          {
            name: 'channel',
            type: 'varchar',
            length: '16'
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16'
          },
          {
            name: 'destination',
            type: 'varchar',
            length: '191',
            isNullable: true
          },
          {
            name: 'reason',
            type: 'varchar',
            length: '191'
          },
          {
            name: 'providerMessageId',
            type: 'varchar',
            length: '191',
            isNullable: true
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true
          },
          {
            name: 'attemptedAt',
            type: 'datetime',
            precision: 3
          },
          {
            name: 'createdAt',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)'
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
            onUpdate: 'CURRENT_TIMESTAMP(3)'
          }
        ]
      })
    );

    await queryRunner.createIndex(
      'MessageDispatchAudit',
      new TableIndex({
        name: 'IDX_MessageDispatchAudit_lookup',
        columnNames: ['entityType', 'entityId', 'notificationType', 'channel', 'status']
      })
    );

    await queryRunner.createIndex(
      'MessageDispatchAudit',
      new TableIndex({
        name: 'IDX_MessageDispatchAudit_attemptedAt',
        columnNames: ['attemptedAt']
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('MessageDispatchAudit', 'IDX_MessageDispatchAudit_attemptedAt');
    await queryRunner.dropIndex('MessageDispatchAudit', 'IDX_MessageDispatchAudit_lookup');
    await queryRunner.dropTable('MessageDispatchAudit');
  }
}
