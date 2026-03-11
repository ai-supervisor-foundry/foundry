import { compareSync, genSaltSync, hashSync } from 'bcrypt';
import { Exclude } from 'class-transformer';
import { Audit } from '../../../db/custom.base.entity';
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity()
@Index('user_email_uc', ['email'], {
  unique: true,
  where: '(deleted_at IS NULL)',
})
export class User extends BaseEntity {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'user_pk' })
  id: number;

  @Column()
  name: string;

  @Column({ length: 100 })
  email: string;

  @Exclude({ toPlainOnly: true })
  @Column({ name: 'password_hash', nullable: true })
  password?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  position: string | null;

  @Column({ name: 'manager_id', type: 'int', nullable: true })
  managerId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: User | null;

  @Column(() => Audit, { prefix: false })
  audit: Audit;

  @BeforeUpdate()
  @BeforeInsert()
  hashPassword() {
    if (!this.password || this.password.startsWith('$2')) return;
    const salt = genSaltSync();
    this.password = hashSync(this.password, salt);
  }

  passwordMatch(plainPassword: string) {
    if (!plainPassword || !this.password) return false;
    return compareSync(plainPassword, this.password);
  }
}
