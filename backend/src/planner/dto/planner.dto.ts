import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AREAS, Area, GOAL_PERIODS, GoalPeriod, RECURRENCE_KINDS, RecurrenceKind } from '../entities/planner.entities';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateProjectDto {
  @ApiProperty() @IsString() @MaxLength(200) name: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() description?: string | null;
}

export class UpdateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() description?: string | null;
}

export class CreateCategoryDto {
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiProperty({ example: '#3B82F6' }) @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color: string;
  @ApiProperty({ enum: AREAS }) @IsIn(AREAS as unknown as string[]) area: Area;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @ApiPropertyOptional({ enum: AREAS }) @IsOptional() @IsIn(AREAS as unknown as string[]) area?: Area;
}

export class CreateTaskDto {
  @ApiProperty({
    description: 'Raw quick-add text: "Fix bug #work !!! @9:30" → tags, priority, start time are parsed out',
  })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ nullable: true, description: 'YYYY-MM-DD, null = backlog' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DAY)
  date?: string | null;

  @ApiProperty({ enum: AREAS }) @IsIn(AREAS as unknown as string[]) area: Area;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() categoryId?: number | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() goalId?: number | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() projectId?: number | null;
  @ApiPropertyOptional({ description: 'Start "In progress" (board quick-add)' })
  @IsOptional()
  @IsBoolean()
  inProgress?: boolean;
  @ApiPropertyOptional({ description: 'Initial notes (Markdown)' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) title?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(DAY)
  date?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() done?: boolean;
  @ApiPropertyOptional({ enum: AREAS }) @IsOptional() @IsIn(AREAS as unknown as string[]) area?: Area;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() categoryId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(3) priority?: number;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1439) startTime?: number | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) duration?: number | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() result?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() reminderAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() goalId?: number | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() projectId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() inProgress?: boolean;
}

export class MoveTaskDto {
  @ApiProperty({ enum: ['backlog', 'doing', 'done'] }) @IsIn(['backlog', 'doing', 'done']) column: 'backlog' | 'doing' | 'done';
}

export class RecurrenceDto {
  @ApiProperty({ enum: RECURRENCE_KINDS, nullable: true, description: 'null stops the series' })
  @ValidateIf((_, v) => v !== null)
  @IsIn(RECURRENCE_KINDS as unknown as string[])
  kind: RecurrenceKind | null;
  @ApiPropertyOptional({ description: 'Bitmask over getDay(): bit0 = Sun … bit6 = Sat' })
  @IsOptional()
  @IsInt()
  weekdays?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(31) monthDay?: number;
}

export class ChecklistCreateDto {
  @ApiProperty() @IsString() @MaxLength(500) title: string;
}

export class ChecklistUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() done?: boolean;
}

export class AttachmentCreateDto {
  @ApiProperty({ enum: ['link', 'file'] }) @IsIn(['link', 'file']) kind: 'link' | 'file';
  @ApiProperty() @IsString() @MaxLength(4000) value: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) title?: string;
}

export class CreateGoalDto {
  @ApiProperty() @IsString() @MaxLength(500) title: string;
  @ApiProperty({ enum: AREAS }) @IsIn(AREAS as unknown as string[]) area: Area;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() categoryId?: number | null;
  @ApiProperty({ enum: GOAL_PERIODS }) @IsIn(GOAL_PERIODS as unknown as string[]) period: GoalPeriod;
  @ApiProperty() @Matches(DAY) periodStart: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) title?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() categoryId?: number | null;
  @ApiPropertyOptional({ enum: GOAL_PERIODS }) @IsOptional() @IsIn(GOAL_PERIODS as unknown as string[]) period?: GoalPeriod;
  @ApiPropertyOptional() @IsOptional() @Matches(DAY) periodStart?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() done?: boolean;
}

export class CreateNoteDto {
  @ApiProperty({ enum: AREAS }) @IsIn(AREAS as unknown as string[]) area: Area;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() categoryId?: number | null;
}

export class UpdateNoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional({ enum: AREAS }) @IsOptional() @IsIn(AREAS as unknown as string[]) area?: Area;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() categoryId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
}

export class DayNoteDto {
  @ApiProperty() @Matches(DAY) day: string;
  @ApiProperty({ enum: AREAS }) @IsIn(AREAS as unknown as string[]) area: Area;
  @ApiProperty() @IsString() body: string;
}

export class EnglishCheckDto {
  @ApiProperty() @IsString() @MaxLength(20000) text: string;
  @ApiPropertyOptional({ description: 'Note id: log the correction against this note' })
  @IsOptional()
  @IsInt()
  noteId?: number;
}
