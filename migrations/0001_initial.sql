CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL,
 email varchar(254) UNIQUE NOT NULL CHECK(email=lower(email)), password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','academic','lecturer','student','finance')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE login_limits (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, reset_at timestamptz NOT NULL);
CREATE TABLE program_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(160) NOT NULL UNIQUE);
CREATE TABLE programs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(160) NOT NULL,type_id uuid NOT NULL REFERENCES program_types(id),description text NOT NULL DEFAULT '',duration_months integer NOT NULL CHECK(duration_months BETWEEN 1 AND 120),fee numeric(12,2) NOT NULL CHECK(fee>=0),active boolean NOT NULL DEFAULT true);
CREATE TABLE specialties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(160) NOT NULL,program_id uuid NOT NULL REFERENCES programs(id),UNIQUE(program_id,name),UNIQUE(id,program_id));
CREATE TABLE cohorts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(160) NOT NULL,program_id uuid NOT NULL REFERENCES programs(id),start_date date NOT NULL,end_date date NOT NULL,CHECK(end_date>=start_date),UNIQUE(id,program_id));
CREATE SEQUENCE student_number_seq START 1001;
CREATE TABLE students (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES users(id),academic_number text NOT NULL UNIQUE DEFAULT ('PA-'||extract(year FROM now())::text||'-'||nextval('student_number_seq')),phone varchar(30) NOT NULL DEFAULT '',admission text NOT NULL DEFAULT 'pending' CHECK(admission IN ('pending','accepted','rejected')));
CREATE TABLE lecturers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES users(id),expertise varchar(160) NOT NULL DEFAULT '');
CREATE TABLE enrollments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES students(id),program_id uuid NOT NULL REFERENCES programs(id),cohort_id uuid NOT NULL,specialty_id uuid,progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','withdrawn')),FOREIGN KEY(cohort_id,program_id) REFERENCES cohorts(id,program_id),FOREIGN KEY(specialty_id,program_id) REFERENCES specialties(id,program_id),UNIQUE(student_id,cohort_id));
CREATE TABLE courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(160) NOT NULL,program_id uuid NOT NULL REFERENCES programs(id),UNIQUE(id,program_id));
CREATE TABLE lectures (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title varchar(160) NOT NULL,program_id uuid NOT NULL REFERENCES programs(id),course_id uuid NOT NULL,cohort_id uuid NOT NULL,lecturer_id uuid NOT NULL REFERENCES lecturers(id),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,location varchar(250) NOT NULL DEFAULT '',CHECK(ends_at>starts_at),FOREIGN KEY(course_id,program_id) REFERENCES courses(id,program_id),FOREIGN KEY(cohort_id,program_id) REFERENCES cohorts(id,program_id));
CREATE INDEX lectures_cohort ON lectures(cohort_id,starts_at);
CREATE TABLE attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lecture_id uuid NOT NULL REFERENCES lectures(id),student_id uuid NOT NULL REFERENCES students(id),status text NOT NULL CHECK(status IN ('present','absent','excused')),UNIQUE(lecture_id,student_id));
CREATE TABLE exams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title varchar(160) NOT NULL,cohort_id uuid NOT NULL REFERENCES cohorts(id),pass_percent integer NOT NULL DEFAULT 60 CHECK(pass_percent BETWEEN 0 AND 100),published boolean NOT NULL DEFAULT false);
CREATE TABLE questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL REFERENCES exams(id),prompt text NOT NULL,options jsonb NOT NULL CHECK(jsonb_array_length(options)=4),correct_index integer NOT NULL CHECK(correct_index BETWEEN 0 AND 3));
CREATE TABLE attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exam_id uuid NOT NULL REFERENCES exams(id),student_id uuid NOT NULL REFERENCES students(id),answers jsonb NOT NULL,score numeric(5,2) NOT NULL CHECK(score BETWEEN 0 AND 100),submitted_at timestamptz NOT NULL DEFAULT now(),UNIQUE(exam_id,student_id));
CREATE TABLE invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES students(id),title varchar(160) NOT NULL,amount numeric(12,2) NOT NULL CHECK(amount>0),due_date date NOT NULL);
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid NOT NULL REFERENCES invoices(id),amount numeric(12,2) NOT NULL CHECK(amount>0),reference varchar(160) NOT NULL UNIQUE,paid_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title varchar(160) NOT NULL,amount numeric(12,2) NOT NULL CHECK(amount>0),spent_on date NOT NULL);
CREATE TABLE certificates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),enrollment_id uuid NOT NULL UNIQUE REFERENCES enrollments(id),code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),issued_at timestamptz NOT NULL DEFAULT now(),revoked boolean NOT NULL DEFAULT false);
CREATE TABLE audit_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid REFERENCES users(id),action text NOT NULL,entity text NOT NULL,record_id uuid,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX enrollments_student ON enrollments(student_id);
CREATE INDEX enrollments_cohort ON enrollments(cohort_id);
CREATE INDEX invoices_student ON invoices(student_id);
CREATE INDEX payments_invoice ON payments(invoice_id);
CREATE INDEX questions_exam ON questions(exam_id);
CREATE INDEX attempts_student ON attempts(student_id);
CREATE INDEX attendance_student ON attendance(student_id);
