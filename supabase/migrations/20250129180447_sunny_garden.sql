/*
  # Initial Schema Setup for Carnival Expense Manager

  1. New Tables
    - `participants`
      - `id` (uuid, primary key)
      - `name` (text)
      - `type` (text) - 'individual' or 'casal'
      - `children` (integer)
      - `created_at` (timestamp)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `description` (text)
      - `amount` (numeric)
      - `category` (text)
      - `date` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their data
*/

-- Create participants table
CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('individual', 'casal')),
  children integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  category text NOT NULL CHECK (category IN ('aluguel', 'compras', 'demaisItens')),
  date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for participants table
CREATE POLICY "Enable read access for all users"
  ON participants
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON participants
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for expenses table
CREATE POLICY "Enable read access for all users"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON expenses
  FOR DELETE
  TO authenticated
  USING (true);