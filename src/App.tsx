import React, { useState, useEffect, useMemo, Component } from 'react';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  logOut, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signInWithGoogle,
  signInAnonymously
} from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  orderBy, 
  Timestamp,
  serverTimestamp,
  setDoc,
  getDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  Plus, 
  LogOut, 
  Layout, 
  Search, 
  Moon, 
  Sun, 
  MoreHorizontal, 
  X, 
  Clock, 
  CheckSquare, 
  Paperclip, 
  MessageSquare, 
  User as UserIcon,
  ChevronLeft,
  Settings,
  PlusCircle,
  Trello,
  ArrowLeft,
  Repeat,
  AlertCircle,
  Zap,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Board, List, Card, UserProfile } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Logo = ({ className, dark = false }: { className?: string, dark?: boolean }) => (
  <div className={cn("logo-versus", className)}>
    <span className={cn("logo-versus-clinica", dark && "text-white/60")}>Clínica</span>
    <span className={cn("logo-versus-main", dark && "text-white")}>VERSUS</span>
  </div>
);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Erro de permissão no Firestore (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Ops! Algo deu errado</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-versus text-white rounded-2xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-versus/20"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const DEFAULT_SECTORS = [
  { id: 'board_comercial', name: 'Comercial', background: 'bg-gradient-to-br from-sky-500 to-blue-700' },
  { id: 'board_staff', name: 'Staff', background: 'bg-gradient-to-br from-fuchsia-600 to-purple-800' },
  { id: 'board_gerencia', name: 'Gerencia', background: 'bg-slate-900' },
  { id: 'board_enfermagem', name: 'Enfermagem', background: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
  { id: 'board_tec_enf', name: 'Tec Enf.', background: 'bg-gradient-to-br from-cyan-600 to-cyan-800' },
  { id: 'board_recepcao', name: 'Recepção', background: 'bg-gradient-to-br from-orange-500 to-orange-700' }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [creatingNewSector, setCreatingNewSector] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLanding, setShowLanding] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardUrgency, setNewCardUrgency] = useState<'low' | 'medium' | 'high'>('low');
  const [newCardIsRecurrent, setNewCardIsRecurrent] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [listMenuId, setListMenuId] = useState<string | null>(null);
  const [listMenuPos, setListMenuPos] = useState<{ top: number, left: number } | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const [listToDeleteId, setListToDeleteId] = useState<string | null>(null);
  const isInitializingRef = React.useRef(false);
  const hasCleanedUpRef = React.useRef(false);
  const lastUserUidRef = React.useRef<string | null>(null);

  // Reset initialization flag when user changes
  useEffect(() => {
    if (user?.uid !== lastUserUidRef.current) {
      console.log('User changed or logged out, resetting initialization refs');
      isInitializingRef.current = false;
      hasCleanedUpRef.current = false;
      lastUserUidRef.current = user?.uid || null;
      
      if (!user) {
        setActiveBoardId(null);
        setBoards([]);
        setLists([]);
        setCards([]);
      }
    }
  }, [user?.uid]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fast path for admin check
        const isAdminEmail = currentUser.email === "elvisbatistadesouza32@gmail.com";
        
        // Try to get role from cache for immediate UI response
        const cachedRole = localStorage.getItem(`role_${currentUser.uid}`);
        if (cachedRole) {
          setIsAdmin(cachedRole === 'admin');
          setIsAuthReady(true);
        } else if (isAdminEmail) {
          setIsAdmin(true);
          // We still need to verify with Firestore, but we can set ready for now
          setIsAuthReady(true);
        }

        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          const role = userSnap.exists() 
            ? (userSnap.data().role || (isAdminEmail ? 'admin' : 'user')) 
            : (isAdminEmail ? 'admin' : 'user');
          
          setIsAdmin(role === 'admin');
          localStorage.setItem(`role_${currentUser.uid}`, role);
          setIsAuthReady(true);

          // Sync profile in background
          setDoc(userRef, {
            name: currentUser.displayName || 'Anonymous',
            email: currentUser.email || '',
            photoUrl: currentUser.photoURL || '',
            role: role
          }, { merge: true }).catch(err => console.error("Background sync error:", err));
        } catch (error) {
          console.error("Error syncing user profile:", error);
          setIsAuthReady(true);
        }
      } else {
        setIsAdmin(false);
        setIsAuthReady(true);
        // Clear cached role on logout
        localStorage.clear();
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize Sectors and Bootstrap Boards
  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthReady || !user || isInitializingRef.current) return;
      isInitializingRef.current = true;

      // For non-admins, we only need to initialize their specific department board
      // This significantly reduces the number of Firestore calls on login
      const userDept = user.displayName?.trim().toLowerCase();
      const sectorsToInit = isAdmin 
        ? DEFAULT_SECTORS 
        : DEFAULT_SECTORS.filter(s => s.name.trim().toLowerCase() === userDept);

      console.log(`Initializing app for ${isAdmin ? 'Admin' : userDept}. Sectors:`, sectorsToInit.map(s => s.name));

      if (sectorsToInit.length === 0 && !isAdmin) {
        console.warn('No sectors found to initialize for user:', user.displayName);
        isInitializingRef.current = false;
        return;
      }

      console.log('Starting optimized initialization for user:', user.uid);
      
      try {
        await Promise.all(sectorsToInit.map(async (sector) => {
          const boardRef = doc(db, 'boards', sector.id);
          const boardSnap = await getDoc(boardRef);

          if (!boardSnap.exists()) {
            console.log(`Creating deterministic board: ${sector.name}`);
            const batch = writeBatch(db);
            
            batch.set(boardRef, {
              name: sector.name,
              ownerId: 'system',
              members: [user.uid],
              background: sector.background,
              createdAt: serverTimestamp()
            });

            // Add default lists in batch
            const defaultLists = ['DEMANDAS', 'EM ANDAMENTO', 'FINALIZADAS'];
            defaultLists.forEach((listName, i) => {
              const listRef = doc(collection(db, `boards/${sector.id}/lists`));
              batch.set(listRef, {
                name: listName,
                boardId: sector.id,
                order: i,
                createdAt: serverTimestamp()
              });
            });

            await batch.commit();
          } else {
            const data = boardSnap.data();
            const currentMembers = data.members || [];
            const updates: any = {};
            
            if (!currentMembers.includes(user.uid)) {
              updates.members = [...currentMembers, user.uid];
            }
            
            if (!data.background || data.background === 'bg-versus' || data.background.includes('slate')) {
              updates.background = sector.background;
            }

            if (Object.keys(updates).length > 0) {
              await updateDoc(boardRef, updates);
            }
          }
        }));
        console.log('Initialization finished.');
      } catch (error: any) {
        console.error('Error during optimized initialization:', error);
      } finally {
        // We keep isInitializingRef.current = true to prevent re-running in the same session
        // unless it's a critical failure, but usually one successful run is enough.
      }
    };

    initializeApp();
  }, [isAdmin, user, isAuthReady]);

  // Global Cleanup for Duplicates (Admin only)
  useEffect(() => {
    if (isAdmin && user && isAuthReady && !hasCleanedUpRef.current) {
      const cleanup = async () => {
        hasCleanedUpRef.current = true;
        console.log('Running global legacy cleanup...');
        
        try {
          const q = query(collection(db, 'boards'));
          const snap = await getDocs(q);
          
          const defaultSectorNames = ['comercial', 'staff', 'gerencia', 'enfermagem', 'tec enf.', 'recepção'];
          const defaultSectorIds = ['board_comercial', 'board_staff', 'board_gerencia', 'board_enfermagem', 'board_tec_enf', 'board_recepcao'];
          
          for (const d of snap.docs) {
            const data = d.data();
            const name = (data.name || '').trim().toLowerCase();
            
            // If it has a default name but NOT a deterministic ID, it's a legacy duplicate
            if (defaultSectorNames.includes(name) && !defaultSectorIds.includes(d.id)) {
              console.log(`Deleting legacy duplicate board: ${data.name} (${d.id})`);
              await deleteBoardWithContents(d.id);
            }
          }
          console.log('Global cleanup finished.');
        } catch (error) {
          console.error('Error during global cleanup:', error);
          hasCleanedUpRef.current = false; // Allow retry on error
        }
      };
      cleanup();
    }
  }, [isAdmin, user, isAuthReady]);

  const deleteBoardWithContents = async (boardId: string) => {
    try {
      // Delete cards
      const cardsSnap = await getDocs(collection(db, `boards/${boardId}/cards`));
      const listsSnap = await getDocs(collection(db, `boards/${boardId}/lists`));
      
      const batch = writeBatch(db);
      cardsSnap.docs.forEach(d => batch.delete(d.ref));
      listsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'boards', boardId));
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting board with contents:', error);
    }
  };

  // Theme Listener
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Boards Listener
  useEffect(() => {
    if (!user || !isAuthReady) return;

    // Admin sees all boards, regular users only see boards they are members of
    const q = isAdmin 
      ? query(collection(db, 'boards'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'boards'),
          where('members', 'array-contains', user.uid)
          // Removed orderBy for non-admins to avoid index requirement and speed up query
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boardsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board));
      
      // Filter boards for non-admins to only show their department board
      let finalBoards = boardsData;
      if (!isAdmin && user.displayName) {
        const userDept = user.displayName.trim().toLowerCase();
        finalBoards = boardsData.filter(b => b.name.trim().toLowerCase() === userDept);
      }

      // Deduplicate boards by name to avoid showing multiple boards for the same sector
      // This can happen if multiple boards were created manually or during initialization
      const uniqueBoards: Board[] = [];
      const seenNames = new Set<string>();
      
      // Sort to prefer deterministic IDs (they start with 'board_')
      const sortedBoards = [...finalBoards].sort((a, b) => {
        const aIsDeterministic = a.id.startsWith('board_');
        const bIsDeterministic = b.id.startsWith('board_');
        if (aIsDeterministic && !bIsDeterministic) return -1;
        if (!aIsDeterministic && bIsDeterministic) return 1;
        // If both are same type, prefer the one with more members or newer
        return (b.members?.length || 0) - (a.members?.length || 0);
      });

      for (const board of sortedBoards) {
        const normalizedName = board.name.trim().toLowerCase();
        if (!seenNames.has(normalizedName)) {
          uniqueBoards.push(board);
          seenNames.add(normalizedName);
        }
      }
      
      setBoards(uniqueBoards);
      setLoadingBoards(false);

      // Auto-select board if user only has one and it's their department
      if (!isAdmin && uniqueBoards.length === 1 && !activeBoardId) {
        setActiveBoardId(uniqueBoards[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'boards');
      setLoadingBoards(false);
    });

    return () => unsubscribe();
  }, [user, isAuthReady, isAdmin, activeBoardId]);

  // Lists & Cards Listener
  useEffect(() => {
    if (!activeBoardId || !user) return;

    const listsQ = query(
      collection(db, `boards/${activeBoardId}/lists`),
      orderBy('order', 'asc')
    );

    const cardsQ = query(
      collection(db, `boards/${activeBoardId}/cards`),
      orderBy('order', 'asc')
    );

    const unsubscribeLists = onSnapshot(listsQ, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as List)));
    });

    const unsubscribeCards = onSnapshot(cardsQ, (snapshot) => {
      setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Card)));
    });

    return () => {
      unsubscribeLists();
      unsubscribeCards();
      setMovingCardId(null);
    };
  }, [activeBoardId, user]);

  const activeBoard = useMemo(() => {
    const board = boards.find(b => b.id === activeBoardId);
    // If we have an activeBoardId but it's not in the boards list yet, 
    // it might be because it's still loading or the user doesn't have access.
    // However, for department users, we pre-set it, so we should wait for it.
    return board;
  }, [boards, activeBoardId]);

  // Reset activeBoardId if it's set but the board doesn't exist in the loaded list 
  // after loading is complete (only for admins, as department users might be waiting for initialization)
  useEffect(() => {
    if (activeBoardId && !loadingBoards && boards.length > 0 && !activeBoard && isAdmin) {
      console.log("Active board not found in list, resetting...");
      setActiveBoardId(null);
    }
  }, [activeBoardId, loadingBoards, boards, activeBoard, isAdmin]);

  const moveCardToList = async (cardId: string, targetListId: string) => {
    if (!activeBoardId) return;
    
    const draggedCard = cards.find(c => c.id === cardId);
    if (!draggedCard) return;

    const sourceListId = draggedCard.listId;
    const otherCards = cards.filter(c => c.id !== cardId);
    
    // Destination list: add to end
    const destListCards = otherCards
      .filter(c => c.listId === targetListId)
      .sort((a, b) => a.order - b.order);
    
    const updatedCard = { ...draggedCard, listId: targetListId, order: destListCards.length };
    destListCards.push(updatedCard);
    
    // Source list: reorder to fill gap
    const sourceListCards = otherCards
      .filter(c => c.listId === sourceListId)
      .sort((a, b) => a.order - b.order);
    const updatedSourceCards = sourceListCards.map((c, i) => ({ ...c, order: i }));

    const finalCards = cards.map(c => {
      if (c.id === cardId) return updatedCard;
      const inSource = updatedSourceCards.find(sc => sc.id === c.id);
      if (inSource) return inSource;
      return c;
    });

    setCards(finalCards);
    setMovingCardId(null);

    try {
      const batch = writeBatch(db);
      const cardRef = doc(db, `boards/${activeBoardId}/cards`, cardId);
      batch.update(cardRef, { 
        listId: targetListId,
        order: updatedCard.order 
      });
      
      updatedSourceCards.forEach(c => {
        const cardRef = doc(db, `boards/${activeBoardId}/cards`, c.id);
        batch.update(cardRef, { order: c.order });
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error moving card:", error);
    }
  };

  const createBoard = async (name: string) => {
    if (!user) return;

    const trimmedName = name.trim();
    const defaultSectorNames = ['comercial', 'staff', 'gerencia', 'enfermagem', 'tec enf.', 'recepção'];
    
    if (defaultSectorNames.includes(trimmedName.toLowerCase())) {
      alert('Este é um setor padrão do sistema e já deve existir. Verifique sua lista de processos.');
      return;
    }

    // Prevent duplicate names for custom boards
    if (boards.some(b => b.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('Já existe um setor com este nome.');
      return;
    }

    const boardData = {
      name: trimmedName,
      ownerId: user.uid,
      members: [user.uid],
      background: 'bg-gradient-to-br from-slate-700 to-slate-900',
      createdAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'boards'), boardData);
    setActiveBoardId(docRef.id);
    setShowNewBoardModal(false);

    // Add default lists
    const defaultLists = ['DEMANDAS', 'EM ANDAMENTO', 'FINALIZADAS'];
    for (let i = 0; i < defaultLists.length; i++) {
      await addDoc(collection(db, `boards/${docRef.id}/lists`), {
        name: defaultLists[i],
        boardId: docRef.id,
        order: i,
        createdAt: Timestamp.now()
      });
    }
  };

  const addList = async (name: string) => {
    if (!activeBoardId) return;
    await addDoc(collection(db, `boards/${activeBoardId}/lists`), {
      name,
      boardId: activeBoardId,
      order: lists.length,
      createdAt: Timestamp.now()
    });
    setAddingList(false);
    setNewListName('');
  };

  const renameList = async (listId: string, newName: string) => {
    if (!activeBoardId || !newName.trim()) return;
    try {
      const listRef = doc(db, `boards/${activeBoardId}/lists`, listId);
      await updateDoc(listRef, { name: newName });
      setEditingListId(null);
      setEditingListName('');
    } catch (error) {
      console.error("Error renaming list:", error);
    }
  };

  const deleteList = async (listId: string) => {
    if (!activeBoardId) return;
    
    try {
      const batch = writeBatch(db);
      
      // Delete cards in the list
      const cardsInList = cards.filter(c => c.listId === listId);
      cardsInList.forEach(c => {
        batch.delete(doc(db, `boards/${activeBoardId}/cards`, c.id));
      });
      
      // Delete the list
      batch.delete(doc(db, `boards/${activeBoardId}/lists`, listId));
      
      await batch.commit();
      setListMenuId(null);
      setListToDeleteId(null);
    } catch (error) {
      console.error("Error deleting list:", error);
    }
  };

  const addCard = async (listId: string, title: string, urgency: 'low' | 'medium' | 'high' = 'low', isRecurrent: boolean = false) => {
    if (!activeBoardId) return;
    const listCards = cards.filter(c => c.listId === listId);
    await addDoc(collection(db, `boards/${activeBoardId}/cards`), {
      title,
      description: '',
      listId,
      boardId: activeBoardId,
      order: listCards.length,
      labels: [],
      members: [],
      checklist: [],
      urgency,
      isRecurrent,
      createdAt: Timestamp.now()
    });
    setAddingCardToList(null);
    setNewCardTitle('');
    setNewCardUrgency('low');
    setNewCardIsRecurrent(false);
  };

  const handleLogOut = async () => {
    try {
      await logOut();
      // State reset is handled by the user?.uid useEffect
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSigningIn) return;
    
    if (!email || !password) {
      setAuthError('Por favor, preencha todos os campos.');
      return;
    }

    setIsSigningIn(true);
    setAuthError(null);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Error signing in:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        // Check if user actually doesn't exist to offer registration
        setAuthError('Email ou senha incorretos. Se você ainda não tem conta, clique em "Criar nova conta".');
      } else {
        setAuthError('Ocorreu um erro ao entrar. Por favor, tente novamente.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError('Erro ao entrar com Google. Tente o e-mail e senha.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDepartmentSignIn = async (deptName: string) => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    
    // Create a unique email for each department to ensure separate sessions
    // Using a fixed password for all departments for simplicity as requested
    const deptEmail = `${deptName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '')}.versus@clinica.com`;
    const sharedPass = 'clinica123';

    try {
      let userCredential;
      try {
        // Try to sign in first
        userCredential = await signInWithEmailAndPassword(auth, deptEmail, sharedPass);
      } catch (signInError: any) {
        // If account doesn't exist, create it automatically
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          userCredential = await createUserWithEmailAndPassword(auth, deptEmail, sharedPass);
        } else {
          throw signInError;
        }
      }

      // Update the display name to the selected department
      if (userCredential) {
        await updateProfile(userCredential.user, {
          displayName: deptName
        });
        
        // Pre-set active board ID for immediate transition
        const sector = DEFAULT_SECTORS.find(s => s.name === deptName);
        if (sector) {
          // Pre-initialize the board right here for faster access
          const boardRef = doc(db, 'boards', sector.id);
          const boardSnap = await getDoc(boardRef);
          
          if (!boardSnap.exists()) {
            console.log(`Pre-creating board for ${deptName}`);
            const batch = writeBatch(db);
            batch.set(boardRef, {
              name: sector.name,
              ownerId: 'system',
              members: [userCredential.user.uid],
              background: sector.background,
              createdAt: serverTimestamp()
            });
            const defaultLists = ['DEMANDAS', 'EM ANDAMENTO', 'FINALIZADAS'];
            defaultLists.forEach((listName, i) => {
              const listRef = doc(collection(db, `boards/${sector.id}/lists`));
              batch.set(listRef, { name: listName, boardId: sector.id, order: i, createdAt: serverTimestamp() });
            });
            await batch.commit();
          } else {
            const data = boardSnap.data();
            const currentMembers = data.members || [];
            if (!currentMembers.includes(userCredential.user.uid)) {
              await updateDoc(boardRef, {
                members: [...currentMembers, userCredential.user.uid]
              });
            }
          }
          setActiveBoardId(sector.id);
        }
        setUser({ ...userCredential.user, displayName: deptName });
      }
    } catch (error: any) {
      console.error('Department Access Error:', error);
      const errorCode = error.code || 'unknown';
      setAuthError(`Erro ao acessar o sistema (${errorCode}). Por favor, verifique se o provedor "E-mail/Senha" está ativado no Firebase Console.`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSigningIn) return;

    if (!name || !email || !password) {
      setAuthError('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsSigningIn(true);
    setAuthError(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: name
      });
      setUser({ ...userCredential.user, displayName: name });
    } catch (error: any) {
      console.error('Error signing up:', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este e-mail já está cadastrado. Tente entrar em vez de criar conta.');
        setIsRegistering(false); // Auto-switch to login
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('Email inválido.');
      } else {
        setAuthError('Ocorreu um erro ao cadastrar. Por favor, tente novamente.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError('Por favor, digite seu email para redefinir a senha.');
      return;
    }

    setIsSigningIn(true);
    setAuthError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      setAuthError(null);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      if (error.code === 'auth/user-not-found') {
        setAuthError('Este email não está cadastrado.');
      } else {
        setAuthError('Ocorreu um erro ao enviar o email de redefinição.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-versus"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 text-center"
        >
          <div className="mb-8">
            <Logo className="scale-150" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Acesso ao Sistema</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 text-sm">Selecione seu setor para entrar na Clínica Versus.</p>
          
          {authError && (
            <div className="mb-8 p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl border border-rose-100 dark:border-rose-800 text-center">
              {authError}
            </div>
          )}

          {/* Quick Access: Departments Only */}
          <div className="grid grid-cols-2 gap-4">
            {DEFAULT_SECTORS.map((sector) => (
              <button
                key={sector.id}
                onClick={() => handleDepartmentSignIn(sector.name)}
                disabled={isSigningIn}
                className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-6 rounded-[2rem] text-slate-700 dark:text-slate-200 font-bold text-base hover:border-versus hover:bg-versus/5 hover:text-versus transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-2 shadow-sm"
              >
                <div className="w-10 h-10 rounded-full bg-versus/10 flex items-center justify-center">
                  <span className="text-versus text-lg">{sector.name[0]}</span>
                </div>
                {sector.name}
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setShowAdminLogin(!showAdminLogin)}
              className="text-xs text-slate-400 hover:text-versus transition-colors"
            >
              {showAdminLogin ? 'Voltar para setores' : 'Acesso Administrativo'}
            </button>
          </div>

          {showAdminLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 text-left"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  E-mail Admin
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="elvis@exemplo.com"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-versus/20 transition-all outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-versus/20 transition-all outline-none text-sm"
                />
              </div>
              <button
                onClick={() => handleSignIn()}
                disabled={isSigningIn}
                className="w-full py-3 bg-versus text-white rounded-xl font-bold text-sm shadow-lg shadow-versus/20 hover:bg-versus/90 transition-all disabled:opacity-50"
              >
                {isSigningIn ? 'Entrando...' : 'Entrar como Admin'}
              </button>
              <button
                onClick={handleResetPassword}
                className="w-full text-[10px] text-versus font-bold hover:underline text-center"
              >
                Esqueci minha senha
              </button>
              {resetEmailSent && (
                <p className="text-[10px] text-emerald-600 text-center mt-2">
                  Link de redefinição enviado!
                </p>
              )}
            </motion.div>
          )}

          <p className="mt-12 text-[10px] text-slate-400 dark:text-slate-600">
            Sistema de Gestão Interna - Clínica Versus
          </p>
        </motion.div>
      </div>
    );
  }

  if (user && showLanding && isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
        {/* Simple Header for Landing */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Logo />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-2">
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-versus/10 text-versus flex items-center justify-center font-bold text-xs">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            <button onClick={handleLogOut} className="text-slate-500 hover:text-rose-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-versus/10 text-versus text-xs font-bold mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-versus opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-versus"></span>
                </span>
                SISTEMA INTERNO
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-[1.1] mb-6 italic">
                Excelência <br /> 
                <span className="text-versus not-italic">em cada detalhe.</span>
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400 mb-10 leading-relaxed max-w-lg">
                Gerencie os atendimentos, processos e tarefas da Clínica Versus com a eficiência que seus pacientes merecem.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShowLanding(false)}
                  className="bg-versus hover:bg-versus/90 text-white font-bold py-4 px-10 rounded-2xl shadow-xl shadow-versus/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg"
                >
                  Acessar Processos
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setShowLanding(false);
                      setShowNewBoardModal(true);
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold py-4 px-10 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-lg"
                  >
                    Criar Novo Setor
                  </button>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-tr from-versus to-versus/40 rounded-[3rem] blur-3xl opacity-20 animate-pulse"></div>
              <div className="relative bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex gap-4 p-2">
                  <div className="w-48 h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div className="h-20 bg-white dark:bg-slate-700 rounded-xl shadow-sm"></div>
                    <div className="h-12 bg-white dark:bg-slate-700 rounded-xl shadow-sm"></div>
                  </div>
                  <div className="w-48 h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div className="h-16 bg-versus/10 border border-versus/20 rounded-xl"></div>
                    <div className="h-24 bg-white dark:bg-slate-700 rounded-xl shadow-sm"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </main>

        <footer className="p-8 text-center text-slate-400 text-sm border-t border-slate-200 dark:border-slate-800">
          <p>&copy; 2026 Clínica Versus. Todos os direitos reservados.</p>
          <p className="mt-2 text-xs opacity-70">Desenvolvido por Elvis Souza</p>
        </footer>
      </div>
    );
  }

  if (!activeBoardId && boards.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="flex items-center gap-4 mb-8">
            {isAdmin && (
              <button 
                onClick={() => setShowLanding(true)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-all"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Seus Processos</h1>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {boards.map(board => (
              <button 
                key={board.id}
                onClick={() => setActiveBoardId(board.id)}
                className={cn(
                  "h-32 rounded-2xl p-4 text-left flex flex-col justify-between transition-all hover:scale-105 shadow-lg relative overflow-hidden group",
                  board.background || 'bg-slate-200 dark:bg-slate-800'
                )}
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                <span className="text-white font-bold text-xl relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">{board.name}</span>
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-white font-semibold text-xs drop-shadow-sm">{board.members.length} membros</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <ChevronLeft className="w-4 h-4 text-white rotate-180" />
                  </div>
                </div>
              </button>
            ))}
            {isAdmin && (
              <button 
                onClick={() => setShowNewBoardModal(true)}
                className="h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-versus hover:text-versus transition-all"
              >
                <PlusCircle className="w-8 h-8" />
                <span className="font-bold">Novo Setor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loadingBoards && !activeBoardId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-versus border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando seus quadros...</p>
        </div>
      </div>
    );
  }

  if (activeBoardId && !activeBoard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-versus border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando quadro...</p>
        </div>
      </div>
    );
  }

  if (!activeBoardId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        {isAdmin && (
          <button 
            onClick={() => setShowLanding(true)}
            className="absolute top-8 left-8 p-3 rounded-full bg-white dark:bg-slate-900 shadow-md text-slate-500 hover:text-versus transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Layout className="text-slate-400 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Nenhum quadro encontrado</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Comece criando seu primeiro projeto para gerenciar suas tarefas.</p>
          {isAdmin && (
            <button 
              onClick={() => setShowNewBoardModal(true)}
              className="bg-versus hover:bg-versus/90 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-versus/20 transition-all active:scale-95"
            >
              Criar Novo Setor
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors", activeBoard?.background || 'bg-slate-50 dark:bg-slate-950')}>
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 h-14 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (isAdmin) {
                setActiveBoardId(null);
                setShowLanding(true);
              } else {
                setActiveBoardId(null);
              }
            }}
            className="hover:opacity-80 transition-opacity"
          >
            <Logo dark className="scale-75 origin-left" />
          </button>
          
          <div className="h-6 w-[1px] bg-white/20 mx-2"></div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (isAdmin) {
                  setActiveBoardId(null);
                  setShowLanding(true);
                } else {
                  setActiveBoardId(null);
                }
              }}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Layout className="w-4 h-4" />
              <span className="hidden md:inline">Início</span>
            </button>
            {isAdmin && (
              <button 
                onClick={() => {
                  setActiveBoardId(null);
                  setShowLanding(false);
                  setShowNewBoardModal(true);
                }}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden md:inline">Novo Setor</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <input 
              type="text" 
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/20 hover:bg-white/30 focus:bg-white text-white focus:text-slate-900 pl-10 pr-4 py-1.5 rounded-md text-sm outline-none transition-all w-48 focus:w-64"
            />
          </div>

          <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-white/80 hover:text-white p-2">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs border border-white/20">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <button onClick={handleLogOut} className="text-white/80 hover:text-white p-2">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Board Subheader */}
      <div className="bg-black/10 backdrop-blur-sm h-12 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveBoardId(null)}
            className="text-white/80 hover:text-white flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
          <div className="h-4 w-[1px] bg-white/20 mx-1"></div>
          <h2 className="text-white font-bold text-lg">{activeBoard?.name || 'Selecione um Setor'}</h2>
          <button className="text-white/60 hover:text-white p-1.5 rounded-md hover:bg-white/10">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {activeBoard?.members.slice(0, 3).map((uid, i) => (
              <div key={uid} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold">
                {uid.slice(0, 2).toUpperCase()}
              </div>
            ))}
            {activeBoard?.members.length && activeBoard.members.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-bold">
                +{activeBoard.members.length - 3}
              </div>
            )}
          </div>
          <button className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
            Convidar
          </button>
        </div>
      </div>

      {/* Kanban Area */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeBoardId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            <div className="flex gap-4 h-full items-start">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="w-72 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl flex flex-col max-h-full shrink-0 shadow-lg border border-white/20 dark:border-slate-800/50 transition-all duration-300"
                >
                  <div className="p-4 flex items-center justify-between group">
                    {editingListId === list.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editingListName}
                          onChange={(e) => setEditingListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameList(list.id, editingListName);
                            if (e.key === 'Escape') setEditingListId(null);
                          }}
                          onBlur={() => renameList(list.id, editingListName)}
                          className="w-full bg-white dark:bg-slate-800 border-none rounded-md p-1 text-sm font-bold outline-none ring-2 ring-blue-500"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm px-2 flex items-center gap-2">
                          {list.name}
                          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-500 font-medium">
                            {cards.filter(c => c.listId === list.id).length}
                          </span>
                        </h3>
                        <button 
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setListMenuPos({ top: rect.top + rect.height, left: rect.left });
                            setListMenuId(list.id);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar min-h-[50px]">
                    {cards
                      .filter(c => c.listId === list.id)
                      .sort((a, b) => a.order - b.order)
                      .map((card) => (
                        <div
                          key={card.id}
                          onClick={() => setMovingCardId(card.id)}
                          className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm mb-2 border border-slate-200 dark:border-slate-700 hover:border-blue-500 group select-none relative hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                          {card.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {card.labels.map(label => (
                                <div key={label.id} className={cn("h-1.5 w-8 rounded-full", label.color)}></div>
                              ))}
                            </div>
                          )}
                          {card.urgency && card.urgency !== 'low' && (
                            <div className={cn(
                              "h-1 w-12 rounded-full mb-2",
                              card.urgency === 'high' ? "bg-rose-500" : "bg-amber-500"
                            )}></div>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-slate-900 dark:text-white">{card.title}</h4>
                            <div className="flex items-center gap-1.5">
                              <div
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 group-hover:text-blue-500 transition-colors"
                                title="Mover tarefa"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </div>
                              {card.isRecurrent && (
                                <Repeat className="w-3 h-3 text-blue-500" />
                              )}
                              {card.urgency === 'high' && (
                                <Zap className="w-3 h-3 text-rose-500 fill-rose-500" />
                              )}
                              {card.urgency === 'medium' && (
                                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 text-slate-400">
                            {card.description && <div className="flex items-center gap-1"><MoreHorizontal className="w-3 h-3" /></div>}
                            {card.checklist.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] font-bold">
                                <CheckSquare className="w-3 h-3" />
                                {card.checklist.filter(i => i.completed).length}/{card.checklist.length}
                              </div>
                            )}
                            {card.dueDate && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500">
                                <Clock className="w-3 h-3" />
                                {card.dueDate.toDate().toLocaleDateString()}
                              </div>
                            )}
                            {card.isRecurrent && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                                <Repeat className="w-3 h-3" />
                                Recorrente
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="p-2">
                    {addingCardToList === list.id ? (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-3">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Título da tarefa..."
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newCardTitle) {
                              addCard(list.id, newCardTitle, newCardUrgency, newCardIsRecurrent);
                            } else if (e.key === 'Escape') {
                              setAddingCardToList(null);
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-versus/50"
                        />
                        
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setNewCardUrgency('low')}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold transition-all",
                                newCardUrgency === 'low' ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              Baixa
                            </button>
                            <button
                              onClick={() => setNewCardUrgency('medium')}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold transition-all",
                                newCardUrgency === 'medium' ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              Média
                            </button>
                            <button
                              onClick={() => setNewCardUrgency('high')}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold transition-all",
                                newCardUrgency === 'high' ? "bg-rose-100 text-rose-700" : "text-slate-400 hover:text-slate-600"
                              )}
                            >
                              Alta
                            </button>
                          </div>

                          <button
                            onClick={() => setNewCardIsRecurrent(!newCardIsRecurrent)}
                            className={cn(
                              "p-1.5 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold",
                              newCardIsRecurrent ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:text-slate-600"
                            )}
                            title="Tarefa Recorrente"
                          >
                            <Repeat className="w-3 h-3" />
                            {newCardIsRecurrent && <span>Recorrente</span>}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (newCardTitle) addCard(list.id, newCardTitle, newCardUrgency, newCardIsRecurrent);
                            }}
                            className="flex-1 bg-versus text-white py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-versus/20"
                          >
                            Adicionar
                          </button>
                          <button
                            onClick={() => setAddingCardToList(null)}
                            className="p-1.5 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setAddingCardToList(list.id)}
                        className="w-full flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar um cartão
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {addingList ? (
                <div className="w-72 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-3 shrink-0">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Nome da lista..."
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newListName) {
                        addList(newListName);
                      } else if (e.key === 'Escape') {
                        setAddingList(false);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-versus/50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (newListName) addList(newListName);
                      }}
                      className="flex-1 bg-versus text-white py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-versus/20"
                    >
                      Adicionar Lista
                    </button>
                    <button
                      onClick={() => setAddingList(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setAddingList(true)}
                  className="w-72 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3 rounded-xl flex items-center gap-2 shrink-0 font-bold transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar outra lista
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* New Board Modal */}
      <AnimatePresence>
        {showNewBoardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewBoardModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden border border-white dark:border-slate-800"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Seus Setores</h3>
                <button onClick={() => setShowNewBoardModal(false)} className="text-slate-400 hover:text-rose-500">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {boards.map(board => (
                    <button 
                      key={board.id}
                      onClick={() => {
                        setActiveBoardId(board.id);
                        setShowNewBoardModal(false);
                      }}
                      className={cn(
                        "h-24 rounded-xl p-3 text-left flex flex-col justify-between transition-all hover:scale-105",
                        board.background,
                        activeBoardId === board.id ? "ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""
                      )}
                    >
                      <span className="text-white font-bold text-sm">{board.name}</span>
                      <div className="flex -space-x-1">
                        {board.members.slice(0, 2).map(m => (
                          <div key={m} className="w-4 h-4 rounded-full bg-white/20 border border-white/40"></div>
                        ))}
                      </div>
                    </button>
                  ))}
                  {creatingNewSector ? (
                    <div className="h-24 rounded-xl border-2 border-versus p-3 flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nome do setor..."
                        value={newSectorName}
                        onChange={(e) => setNewSectorName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSectorName) {
                            createBoard(newSectorName);
                            setNewSectorName('');
                            setCreatingNewSector(false);
                          } else if (e.key === 'Escape') {
                            setCreatingNewSector(false);
                          }
                        }}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold outline-none text-slate-900 dark:text-white"
                      />
                      <div className="flex items-center gap-2 mt-auto">
                        <button 
                          onClick={() => {
                            if (newSectorName) {
                              createBoard(newSectorName);
                              setNewSectorName('');
                              setCreatingNewSector(false);
                            }
                          }}
                          className="flex-1 bg-versus text-white py-1 rounded text-[10px] font-bold"
                        >
                          Criar
                        </button>
                        <button 
                          onClick={() => setCreatingNewSector(false)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    isAdmin && (
                      <button 
                        onClick={() => setCreatingNewSector(true)}
                        className="h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-versus hover:text-versus transition-all"
                      >
                        <PlusCircle className="w-6 h-6" />
                        <span className="text-xs font-bold">Novo Setor</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
      {/* List Menu Portal */}
      <AnimatePresence>
        {listMenuId && listMenuPos && createPortal(
          <>
            <div 
              className="fixed inset-0 z-[100]" 
              onClick={() => {
                setListMenuId(null);
                setListMenuPos(null);
              }}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              style={{
                position: 'fixed',
                top: listMenuPos.top + 8,
                left: listMenuPos.left,
                zIndex: 101
              }}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden w-48"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    const list = lists.find(l => l.id === listMenuId);
                    if (list) {
                      setEditingListId(list.id);
                      setEditingListName(list.name);
                    }
                    setListMenuId(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Repeat className="w-4 h-4" />
                  <span>Renomear</span>
                </button>
                <button
                  onClick={() => setListToDeleteId(listMenuId)}
                  className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Excluir Lista</span>
                </button>
              </div>
            </motion.div>
          </>,
          document.body
        )}
      </AnimatePresence>

      {/* Delete List Confirmation Modal */}
      <AnimatePresence>
        {listToDeleteId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setListToDeleteId(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-white dark:border-slate-800 overflow-hidden w-full max-w-sm relative z-10 p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Excluir Lista?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                Esta ação excluirá permanentemente a lista <strong>{lists.find(l => l.id === listToDeleteId)?.name}</strong> e todos os cartões dentro dela.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => deleteList(listToDeleteId)}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-rose-500/20"
                >
                  Sim, Excluir
                </button>
                <button
                  onClick={() => setListToDeleteId(null)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Move Menu Modal */}
      <AnimatePresence>
        {movingCardId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMovingCardId(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-white dark:border-slate-800 overflow-hidden w-full max-w-sm relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Mover Tarefa</h3>
                </div>
                <button 
                  onClick={() => setMovingCardId(null)}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <p className="text-sm text-slate-500 dark:text-slate-400 px-2 mb-4">
                  Selecione a etapa para onde deseja transferir esta tarefa:
                </p>
                {lists.map(targetList => {
                  const cardToMove = cards.find(c => c.id === movingCardId);
                  const isCurrentList = targetList.id === cardToMove?.listId;
                  
                  return (
                    <button
                      key={targetList.id}
                      disabled={isCurrentList}
                      onClick={() => moveCardToList(movingCardId, targetList.id)}
                      className={cn(
                        "w-full text-left px-4 py-4 rounded-2xl transition-all flex items-center justify-between group",
                        isCurrentList 
                          ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-default" 
                          : "text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isCurrentList ? "bg-slate-300 dark:bg-slate-700" : "bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        )} />
                        <span className="font-bold">{targetList.name}</span>
                      </div>
                      {isCurrentList && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Atual</span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center">
                <p className="text-xs text-slate-400">
                  Clique fora para cancelar a movimentação.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="p-8 text-center text-slate-400 text-sm border-t border-slate-200 dark:border-slate-800 mt-auto">
        <p>&copy; 2026 Clínica Versus. Todos os direitos reservados.</p>
        <p className="mt-2 text-xs opacity-70">Desenvolvido por Elvis Souza</p>
      </footer>
    </div>
  );
}
