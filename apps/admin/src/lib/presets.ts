import type { AccountPreset } from '../types/db'

export interface PresetLabels {
  participant: string
  participants: string
  program: string
  programs: string
  context: string
  contexts: string
  operator: string
  operators: string
  group: string
  groups: string
}

export interface PresetDefinition {
  value: AccountPreset
  label: string
  description: string
  labels: PresetLabels
  features: {
    gradebook: boolean
    timetable: boolean
    parentView: boolean
    checkout: boolean
    terms: boolean
  }
}

const BASE_FEATURES = {
  gradebook: false,
  timetable: false,
  parentView: false,
  checkout: false,
  terms: false,
}

export const PRESETS: Record<AccountPreset, PresetDefinition> = {
  school: {
    value: 'school',
    label: 'School',
    description: 'Nursery, primary, and secondary. Classes, terms, students, grades.',
    labels: {
      participant: 'Student',
      participants: 'Students',
      program: 'Course',
      programs: 'Courses',
      context: 'Session',
      contexts: 'Sessions',
      operator: 'Lecturer',
      operators: 'Lecturers',
      group: 'Class',
      groups: 'Classes',
    },
    features: { ...BASE_FEATURES, gradebook: true, timetable: true, parentView: true, terms: true },
  },
  university: {
    value: 'university',
    label: 'University',
    description: 'Departments, years, semesters, courses, grades.',
    labels: {
      participant: 'Student',
      participants: 'Students',
      program: 'Course',
      programs: 'Courses',
      context: 'Lecture',
      contexts: 'Lectures',
      operator: 'Lecturer',
      operators: 'Lecturers',
      group: 'Department',
      groups: 'Departments',
    },
    features: { ...BASE_FEATURES, gradebook: true, timetable: true, parentView: false, terms: true },
  },
  symposium: {
    value: 'symposium',
    label: 'Symposium',
    description: 'Talks, tracks, attendees.',
    labels: {
      participant: 'Attendee',
      participants: 'Attendees',
      program: 'Track',
      programs: 'Tracks',
      context: 'Talk',
      contexts: 'Talks',
      operator: 'Speaker',
      operators: 'Speakers',
      group: 'Group',
      groups: 'Groups',
    },
    features: { ...BASE_FEATURES },
  },
  bootcamp: {
    value: 'bootcamp',
    label: 'Bootcamp',
    description: 'Modules, cohorts, trainees.',
    labels: {
      participant: 'Trainee',
      participants: 'Trainees',
      program: 'Cohort',
      programs: 'Cohorts',
      context: 'Module',
      contexts: 'Modules',
      operator: 'Instructor',
      operators: 'Instructors',
      group: 'Cohort',
      groups: 'Cohorts',
    },
    features: { ...BASE_FEATURES },
  },
  conference: {
    value: 'conference',
    label: 'Conference',
    description: 'Sessions, tracks, delegates.',
    labels: {
      participant: 'Delegate',
      participants: 'Delegates',
      program: 'Track',
      programs: 'Tracks',
      context: 'Session',
      contexts: 'Sessions',
      operator: 'Speaker',
      operators: 'Speakers',
      group: 'Group',
      groups: 'Groups',
    },
    features: { ...BASE_FEATURES },
  },
  hotel: {
    value: 'hotel',
    label: 'Hotel',
    description: 'Rooms, stays, guests.',
    labels: {
      participant: 'Guest',
      participants: 'Guests',
      program: 'Room',
      programs: 'Rooms',
      context: 'Stay',
      contexts: 'Stays',
      operator: 'Staff',
      operators: 'Staff',
      group: 'Group',
      groups: 'Groups',
    },
    features: { ...BASE_FEATURES, checkout: true },
  },
  event: {
    value: 'event',
    label: 'Event',
    description: 'Checkpoints, guests, entries.',
    labels: {
      participant: 'Guest',
      participants: 'Guests',
      program: 'Group',
      programs: 'Groups',
      context: 'Checkpoint',
      contexts: 'Checkpoints',
      operator: 'Staff',
      operators: 'Staff',
      group: 'Group',
      groups: 'Groups',
    },
    features: { ...BASE_FEATURES, checkout: true },
  },
  custom: {
    value: 'custom',
    label: 'Custom',
    description: 'Your own structure.',
    labels: {
      participant: 'Person',
      participants: 'People',
      program: 'Group',
      programs: 'Groups',
      context: 'Occurrence',
      contexts: 'Occurrences',
      operator: 'Operator',
      operators: 'Operators',
      group: 'Group',
      groups: 'Groups',
    },
    features: { ...BASE_FEATURES },
  },
}

export function getPreset(preset: AccountPreset | undefined | null): PresetDefinition {
  if (!preset) return PRESETS.school
  return PRESETS[preset] ?? PRESETS.school
}