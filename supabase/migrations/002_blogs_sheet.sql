-- migration: blogs_sheet

CREATE TABLE public.blogs_sheet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_link TEXT,
  report_link TEXT,
  comment TEXT,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES public.profiles(id)
);

-- Turn on Row Level Security
ALTER TABLE public.blogs_sheet ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all authenticated users" ON public.blogs_sheet
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.blogs_sheet
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.blogs_sheet
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.blogs_sheet
  FOR DELETE USING (auth.role() = 'authenticated');

-- Function to setup updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_blogs_sheet_updated_at
  BEFORE UPDATE ON public.blogs_sheet
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Dummy seed for verification
INSERT INTO public.blogs_sheet (id, content_link, report_link, comment, remark)
VALUES ('b0000000-0000-0000-0000-000000000001', 'https://example.com/blog-draft-1', 'https://example.com/analytics-1', 'Draft mostly finished, waiting on SEO tags', 'Checked, please apply requested keyword changes.')
ON CONFLICT (id) DO NOTHING;
