import React, { useState, useEffect, useMemo } from 'react';
import { googleSignIn, logout } from '@/lib/firebase/auth';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { Mail, CheckCircle2, Circle, Loader2, AlertTriangle, FileText, LogOut } from 'lucide-react';
import { format } from 'date-fns';

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col bg-[#0F0F0F] border border-[#1F1F1F] min-h-0 ${className}`}>
      {children}
    </section>
  );
}

function PanelHeader({ icon, title, meta, actions }: { icon: React.ReactNode; title: string; meta?: React.ReactNode; actions?: React.ReactNode; }) {
  return (
    <header className="shrink-0 h-9 flex items-center justify-between px-3 border-b border-[#1F1F1F] bg-[#0A0A0A]">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-[#6E6E6E]">{icon}</div>
        <h2 className="text-[12px] font-semibold text-[#EDEDED]">{title}</h2>
        {meta && <span className="text-[11px] text-[#6E6E6E] pl-2 border-l border-[#1F1F1F] ml-1">{meta}</span>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}

type SubmissionStatus = {
  meetingId: number;
  submitted: boolean;
  subjectMatch: boolean;
  fileName: string;
  timestamp: string;
  matchedSubject?: string;
  error?: string;
};

export function ReportTracker() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('gmail_access_token'));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('gmail_user_email'));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  
  const schedules = useAppStore(s => s.schedules);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  
  // Set default subject if not selected
  useEffect(() => {
    if (schedules.length > 0 && !selectedSubject) {
      setSelectedSubject('ALL');
    }
  }, [schedules, selectedSubject]);

  const defaultSearchQuery = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'ALL') return '"PENGUMPULAN LAPORAN"';
    return `"PENGUMPULAN LAPORAN" "${selectedSubject.toUpperCase()}"`;
  }, [selectedSubject]);

  const [searchQuery, setSearchQuery] = useState(defaultSearchQuery);
  
  // Update search query when subject changes
  useEffect(() => {
    setSearchQuery(defaultSearchQuery);
  }, [defaultSearchQuery]);

  const [submissions, setSubmissions] = useState<SubmissionStatus[]>([]);
  const [unparsedEmails, setUnparsedEmails] = useState<any[]>([]);
  
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        if (result.user.email) {
          setUserEmail(result.user.email);
        }
        toast.success('Signed in to Google Workspace successfully');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      toast.error('Failed to sign in: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setToken(null);
      setUserEmail(null);
      setSubmissions([]);
      setUnparsedEmails([]);
      toast.success('Signed out successfully');
    } catch (err: any) {
      toast.error('Failed to sign out: ' + err.message);
    }
  };

  const crawlEmails = async () => {
    if (!token) {
      toast.error('Please sign in first');
      return;
    }
    
    setIsCrawling(true);
    try {
      // Step 1: Search for Google Forms receipts for Deep Learning
      const query = encodeURIComponent(searchQuery);
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) { const text = await res.text(); throw new Error(`Failed to fetch emails: ${res.status} ${text}`); }
      
      const data = await res.json();
      if (!data.messages) {
        setSubmissions([]);
        toast.info('No submissions found in your email');
        setIsCrawling(false);
        return;
      }
      
      const newSubmissions: SubmissionStatus[] = [];
      const newUnparsedEmails: any[] = [];
      
      // Step 2: Fetch message details
      for (const msg of data.messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const msgData = await msgRes.json();
        
        let bodyContent = '';
        
        // Helper to decode base64 utf-8
        const decodeB64 = (data: string) => {
          try {
            return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));
          } catch (e) {
            try { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); } catch (e2) { return ''; }
          }
        };

        if (msgData.payload.parts) {
          // Find text/html first to get the full table
          let part = msgData.payload.parts.find((p: any) => p.mimeType === 'text/html');
          if (!part) part = msgData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
          
          if (part && part.body && part.body.data) {
            bodyContent = decodeB64(part.body.data);
          } else if (msgData.payload.parts[0]?.parts) {
            // Sometimes it's nested in multipart/alternative
            let subPart = msgData.payload.parts[0].parts.find((p: any) => p.mimeType === 'text/html');
            if (!subPart) subPart = msgData.payload.parts[0].parts.find((p: any) => p.mimeType === 'text/plain');
            if (subPart && subPart.body && subPart.body.data) {
              bodyContent = decodeB64(subPart.body.data);
            }
          }
        } else if (msgData.payload.body && msgData.payload.body.data) {
          bodyContent = decodeB64(msgData.payload.body.data);
        }
        
        // Strip HTML tags and normalize whitespace to easily match with regex
        const plainText = bodyContent
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>|<\/div>|<\/tr>|<\/td>|<\/h[1-6]>/gi, '\n')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/[ \t]+/g, ' ') // replace multiple spaces with single space
          .trim();
        
        // Extract timestamp from internalDate
        const timestamp = new Date(parseInt(msgData.internalDate)).toISOString();

        // Parse filename first because we can fallback to it for the meeting ID
        const fileNameMatch = plainText.match(/(?:UNGGAH FILE LAPORAN|File yang dikirim).*?([a-zA-Z0-9_\-\s]+\.pdf)/i) ||
                              plainText.match(/([a-zA-Z0-9_\-\s]+DL[\w_\-\s]*\.pdf)/i) ||
                              plainText.match(/([a-zA-Z0-9_\-\s]+\.pdf)/i);
        const fileName = fileNameMatch ? fileNameMatch[1].trim() : 'Unknown File';

        // Parse meeting ID
        let meetingId = 0;
        
        // Sometimes Google Forms puts a checkmark or just lists the selected option
        const meetingMatch = plainText.match(/PERTEMUAN KE-[^\d]*(\d+)/i) || 
                             plainText.match(/Laporan pertemuan keberapa[^\d]*(\d+)/i) ||
                             plainText.match(/PERTEMUAN KE-\s*(?:\*\s*)?(\d+)/i);
                             
        if (meetingMatch) {
          meetingId = parseInt(meetingMatch[1]);
        }
        
        // Fallback: Check for checkmark format
        if (!meetingId) {
          const checklistMatch = plainText.match(/✓\s*(\d+)/);
          if (checklistMatch) meetingId = parseInt(checklistMatch[1]);
        }
        
        // Fallback: Extract from filename (e.g. 2200018401_DL_7.pdf -> 7)
        if (!meetingId && fileName !== 'Unknown File') {
          const fnMatch = fileName.match(/DL[_\s-]*(\d+)/i) || fileName.match(/P[_\s-]*(\d+)/i) || fileName.match(/_(\d+)\s*-/i) || fileName.match(/_(\d+)\.pdf/i);
          if (fnMatch) {
            meetingId = parseInt(fnMatch[1]);
          }
        }
        
        // Verify against selected subject
        let matchedSubjectMatch = false;
        let matchedSubjectStr = undefined;
        
        if (selectedSubject === 'ALL') {
          for (const s of schedules) {
            const norm = s.mataPraktikum.toUpperCase();
            const acr = norm.split(/\s+/).map(w => w[0]).join('');
            if (plainText.toUpperCase().includes(norm) || 
                fileName.toUpperCase().includes(acr) ||
                fileName.toUpperCase().includes(norm.replace(/\s+/g, '_'))) {
              matchedSubjectMatch = true;
              matchedSubjectStr = s.mataPraktikum;
              break;
            }
          }
        } else {
          const normalizedSubject = (selectedSubject || 'DEEP LEARNING').toUpperCase();
          const subjectAcronym = normalizedSubject.split(/\s+/).map(w => w[0]).join('');
          
          matchedSubjectMatch = plainText.toUpperCase().includes(normalizedSubject) || 
                               fileName.toUpperCase().includes(subjectAcronym) ||
                               fileName.toUpperCase().includes(normalizedSubject.replace(/\s+/g, '_'));
          matchedSubjectStr = selectedSubject;
        }

        if (meetingId > 0) {
          newSubmissions.push({
            meetingId,
            submitted: true,
            subjectMatch: matchedSubjectMatch,
            matchedSubject: matchedSubjectStr,
            fileName,
            timestamp
          });
        } else {
          newUnparsedEmails.push({
            subject: msgData.payload.headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value,
            snippet: msgData.snippet,
            body: plainText.substring(0, 1000)
          });
        }
      }
      
      newSubmissions.sort((a, b) => a.meetingId - b.meetingId);
      
      const latestSubmissions: Record<number, SubmissionStatus> = {};
      newSubmissions.forEach(sub => {
        if (!latestSubmissions[sub.meetingId] || new Date(sub.timestamp) > new Date(latestSubmissions[sub.meetingId].timestamp)) {
          latestSubmissions[sub.meetingId] = sub;
        }
      });
      
      setSubmissions(Object.values(latestSubmissions));
      setUnparsedEmails(newUnparsedEmails);
      toast.success(`Found ${Object.keys(latestSubmissions).length} valid submissions, ${newUnparsedEmails.length} unparsed`);
      
    } catch (err: any) {
      console.error('Crawl error:', err);
      toast.error('Failed to crawl emails: ' + err.message);
    } finally {
      setIsCrawling(false);
    }
  };

  return (
    <Panel className="shrink-0 min-h-[300px]">
      <PanelHeader 
        icon={<Mail className="w-3.5 h-3.5" />} 
        title="Gmail Submission Tracker" 
        actions={
          token ? (
            <div className="flex items-center gap-3">
              {userEmail && (
                <span className="text-[11px] text-[#A1A1A1]">{userEmail}</span>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                className="h-6 px-3 flex items-center gap-1.5 text-[11px] font-medium text-[#EDEDED] bg-[#111111] hover:bg-[#1F1F1F] border border-[#2A2A2A] transition-colors rounded-sm"
              >
                <LogOut className="w-3 h-3" />
                <span>Switch Account</span>
              </button>
              <button
                onClick={crawlEmails}
                disabled={isCrawling}
                className="h-6 px-3 flex items-center gap-1.5 text-[11px] font-medium text-[#EDEDED] bg-[#2F81F7] hover:bg-[#2563EB] disabled:opacity-50 transition-colors rounded-sm"
              >
                {isCrawling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                <span>{isCrawling ? 'Crawling...' : 'Scan Inbox'}</span>
              </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="h-6 px-3 flex items-center gap-1.5 text-[11px] font-medium text-[#EDEDED] bg-[#2EA043] hover:bg-[#238636] disabled:opacity-50 transition-colors rounded-sm"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              <span>Sign in with Google</span>
            </button>
          )
        }
      />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!token ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Mail className="w-10 h-10 text-[#6E6E6E] mb-4" />
            <p className="text-[13px] text-[#A1A1A1] max-w-md">
              Sign in with Google to allow Reglab to scan your Gmail for Google Forms submission receipts. 
              This lets you track which practicum reports you have successfully submitted and verifies their correctness.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 mb-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#A1A1A1]">Select Practicum Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="bg-[#111111] border border-[#1F1F1F] rounded-sm px-2.5 py-1.5 text-[12px] text-[#EDEDED] focus:outline-none focus:border-[#4A4A4A] transition-colors"
                >
                  <option value="ALL">All Subjects (Combined Scan)</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.mataPraktikum}>{s.mataPraktikum}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#A1A1A1]">Gmail Search Query</label>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#111111] border border-[#1F1F1F] rounded-sm px-2.5 py-1.5 text-[12px] text-[#EDEDED] focus:outline-none focus:border-[#4A4A4A] transition-colors"
                  placeholder='e.g., subject:"Tanda Terima" Laporan Praktikum'
                />
                <p className="text-[10px] text-[#6E6E6E]">Edit this if your submission receipt emails have a different subject or keyword.</p>
              </div>
            </div>
            
            {submissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-[#1F1F1F] rounded-md border-dashed">
                <p className="text-[13px] text-[#A1A1A1]">
                  Click "Scan Inbox" to find your report submissions using the query above.
                </p>
              </div>
            ) : selectedSubject === 'ALL' ? (
              <div className="flex flex-col gap-6">
                {schedules.map(schedule => (
                  <div key={schedule.id} className="border border-[#1F1F1F] rounded-md overflow-hidden">
                    <div className="bg-[#111111] px-4 py-2 border-b border-[#1F1F1F]">
                      <h3 className="text-[12px] font-semibold text-[#EDEDED]">{schedule.mataPraktikum}</h3>
                    </div>
                    <table className="w-full text-[12px] text-left">
                      <thead className="bg-[#0A0A0A] border-b border-[#1F1F1F] text-[#A1A1A1]">
                        <tr>
                          <th className="px-4 py-2 font-medium">Session</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Validation</th>
                          <th className="px-4 py-2 font-medium">File Name</th>
                          <th className="px-4 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F1F1F]">
                        {Array.from({ length: 14 }, (_, i) => i + 1).map(meetingNum => {
                          const sub = submissions.find(s => s.meetingId === meetingNum && s.matchedSubject === schedule.mataPraktikum);
                          
                          return (
                            <tr key={meetingNum} className="hover:bg-[#111111]/50">
                              <td className="px-4 py-2.5 font-mono text-[#EDEDED]">P{String(meetingNum).padStart(2, '0')}</td>
                              <td className="px-4 py-2.5">
                                {sub ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#2EA043]/10 text-[#2EA043] border border-[#2EA043]/20">
                                    <CheckCircle2 className="w-3 h-3" /> Submitted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1F1F1F] text-[#A1A1A1] border border-[#2A2A2A]">
                                    <Circle className="w-3 h-3" /> Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {sub ? (
                                  sub.subjectMatch ? (
                                    <span className="flex items-center gap-1.5 text-[#2EA043]">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5 text-[#F85149]" title="Subject mismatch: Might be wrong report!">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Warning
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[#4A4A4A]">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 max-w-[200px] truncate">
                                {sub ? (
                                  <span className="flex items-center gap-1.5 text-[#A1A1A1]" title={sub.fileName}>
                                    <FileText className="w-3.5 h-3.5 shrink-0" /> {sub.fileName}
                                  </span>
                                ) : (
                                  <span className="text-[#4A4A4A]">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-[#A1A1A1]">
                                {sub ? format(new Date(sub.timestamp), 'dd MMM yyyy HH:mm') : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#1F1F1F] rounded-md overflow-hidden">
            <table className="w-full text-[12px] text-left">
              <thead className="bg-[#111111] border-b border-[#1F1F1F] text-[#A1A1A1]">
                <tr>
                  <th className="px-4 py-2 font-medium">Session</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Validation</th>
                  <th className="px-4 py-2 font-medium">File Name</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F1F1F]">
                {Array.from({ length: 14 }, (_, i) => i + 1).map(meetingNum => {
                  const sub = submissions.find(s => s.meetingId === meetingNum);
                  
                  return (
                    <tr key={meetingNum} className="hover:bg-[#111111]/50">
                      <td className="px-4 py-2.5 font-mono text-[#EDEDED]">P{String(meetingNum).padStart(2, '0')}</td>
                      <td className="px-4 py-2.5">
                        {sub ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#2EA043]/10 text-[#2EA043] border border-[#2EA043]/20">
                            <CheckCircle2 className="w-3 h-3" /> Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1F1F1F] text-[#A1A1A1] border border-[#2A2A2A]">
                            <Circle className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {sub ? (
                          sub.subjectMatch ? (
                            <span className="flex items-center gap-1.5 text-[#2EA043]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[#F85149]" title="Subject mismatch: Might be wrong report!">
                              <AlertTriangle className="w-3.5 h-3.5" /> Warning
                            </span>
                          )
                        ) : (
                          <span className="text-[#4A4A4A]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate">
                        {sub ? (
                          <span className="flex items-center gap-1.5 text-[#A1A1A1]" title={sub.fileName}>
                            <FileText className="w-3.5 h-3.5 shrink-0" /> {sub.fileName}
                          </span>
                        ) : (
                          <span className="text-[#4A4A4A]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#A1A1A1]">
                        {sub ? format(new Date(sub.timestamp), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          
        {unparsedEmails.length > 0 && (
          <div className="mt-4 border border-[#1F1F1F] rounded-md p-4">
            <h3 className="text-[13px] font-medium text-[#EDEDED] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E3B341]" />
              Unmatched Emails ({unparsedEmails.length})
            </h3>
            <p className="text-[11px] text-[#A1A1A1] mb-4">
              These emails matched your search but we couldn't find the meeting number (e.g. "Pertemuan ke-X") inside them.
            </p>
            <div className="flex flex-col gap-3">
              {unparsedEmails.map((email, idx) => (
                <div key={idx} className="bg-[#111111] p-3 rounded border border-[#1F1F1F]">
                  <p className="text-[12px] font-medium text-[#EDEDED] mb-1">{email.subject}</p>
                  <p className="text-[11px] text-[#A1A1A1] mb-2">{email.snippet}</p>
                  <pre className="text-[10px] text-[#6E6E6E] whitespace-pre-wrap font-mono overflow-x-auto">{email.body}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </Panel>
  );
}
