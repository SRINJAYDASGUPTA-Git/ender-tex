"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import axios from "@/utils/axiosInstance";
import { UserResponse } from "@/types";

interface UserContextType {
    user: UserResponse | null;
    loading: boolean;
    setUser: (user: UserResponse | null) => void;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    setUser: () => {},
    refreshUser: async () => {},
});

export const UserProvider = ({
                                 children,
                             }: {
    children: React.ReactNode;
}) => {
    const [user, setUser] = useState<UserResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const res = await axios.get<UserResponse>("/users/me");
            setUser(res.data);
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    return (
        <UserContext.Provider
            value={{
                user,
                loading,
                setUser,
                refreshUser: fetchUser,
            }}
        >
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);