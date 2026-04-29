import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CriarWhatsAppInboundAudit20260428170000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'WhatsAppInboundAudit',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment'
          },
          {
            name: 'providerMessageId',
            type: 'varchar',
            length: '191',
            isUnique: true
          },
          {
            name: 'fromPhone',
            type: 'varchar',
            length: '191'
          },
          {
            name: 'toPhone',
            type: 'varchar',
            length: '191',
            isNullable: true
          },
          {
            name: 'rawBody',
            type: 'text'
          },
          {
            name: 'parsedOption',
            type: 'varchar',
            length: '16',
            isNullable: true
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32'
          },
          {
            name: 'reminderId',
            type: 'int',
            isNullable: true
          },
          {
            name: 'treatmentId',
            type: 'int',
            isNullable: true
          },
          {
            name: 'patientId',
            type: 'int',
            isNullable: true
          },
          {
            name: 'contentId',
            type: 'int',
            isNullable: true
          },
          {
            name: 'responseAction',
            type: 'varchar',
            length: '64',
            isNullable: true
          },
          {
            name: 'matchedReminderEntityId',
            type: 'varchar',
            length: '191',
            isNullable: true
          },
          {
            name: 'replyMessageId',
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
            name: 'receivedAt',
            type: 'datetime',
            precision: 3
          },
          {
            name: 'processedAt',
            type: 'datetime',
            precision: 3,
            isNullable: true
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
      'WhatsAppInboundAudit',
      new TableIndex({
        name: 'IDX_WhatsAppInboundAudit_fromPhone_receivedAt',
        columnNames: ['fromPhone', 'receivedAt']
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('WhatsAppInboundAudit', 'IDX_WhatsAppInboundAudit_fromPhone_receivedAt');
    await queryRunner.dropTable('WhatsAppInboundAudit');
  }
}
