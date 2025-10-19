import axios, { AxiosInstance } from "axios";

interface GlpiConfig {
  apiUrl: string;
  userToken: string;
  appToken: string;
}

export class GlpiClient {
  private client: AxiosInstance;
  private sessionToken: string | null = null;

  constructor(private config: GlpiConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        "Content-Type": "application/json",
        "App-Token": config.appToken,
      },
    });
  }

  async initSession(): Promise<string> {
    try {
      const response = await this.client.get("/initSession", {
        headers: {
          Authorization: `user_token ${this.config.userToken}`,
        },
      });
      this.sessionToken = response.data.session_token as string;
      console.log("GLPI session initialized successfully");
      return this.sessionToken;
    } catch (error: any) {
      console.error("Failed to initialize GLPI session:", error.response?.data || error.message);
      throw new Error("Failed to authenticate with GLPI");
    }
  }

  async validateSession(): Promise<boolean> {
    if (!this.sessionToken) {
      return false;
    }
    
    try {
      await this.client.get("/getActiveProfile", {
        headers: {
          "Session-Token": this.sessionToken,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async ensureSession(): Promise<string> {
    const isValid = await this.validateSession();
    if (!isValid) {
      console.log("Session invalid or expired, initializing new session...");
      await this.initSession();
    }
    return this.sessionToken!;
  }

  async killSession(): Promise<void> {
    if (this.sessionToken) {
      try {
        await this.client.get("/killSession", {
          headers: {
            "Session-Token": this.sessionToken,
          },
        });
      } catch (error) {
        console.error("Failed to kill GLPI session:", error);
      }
      this.sessionToken = null;
    }
  }

  async getTickets(params: {
    range?: string;
  } = {}): Promise<any[]> {
    const sessionToken = await this.ensureSession();
    
    try {
      const queryParams = new URLSearchParams();
      if (params.range) queryParams.append("range", params.range);
      
      let url = `/Ticket/?${queryParams.toString()}`;
      
      const response = await this.client.get(url, {
        headers: {
          "Session-Token": sessionToken,
        },
      });

      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Failed to fetch tickets:", error.response?.data || error.message);
      // Session might be expired, try to reinitialize
      if (error.response?.status === 401) {
        this.sessionToken = null;
        return this.getTickets(params);
      }
      throw error;
    }
  }

  async getTicket(id: number): Promise<any> {
    const sessionToken = await this.ensureSession();
    
    try {
      const response = await this.client.get(`/Ticket/${id}`, {
        headers: {
          "Session-Token": sessionToken,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ticket ${id}:`, error);
      throw error;
    }
  }

  async getCategories(): Promise<any[]> {
    const sessionToken = await this.ensureSession();
    
    try {
      const response = await this.client.get("/ITILCategory/?range=0-99", {
        headers: {
          "Session-Token": sessionToken,
        },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Failed to fetch categories:", error.response?.data || error.message);
      if (error.response?.status === 401) {
        this.sessionToken = null;
        return this.getCategories();
      }
      throw error;
    }
  }

  async getUsers(): Promise<any[]> {
    const sessionToken = await this.ensureSession();
    
    try {
      const response = await this.client.get("/User/?range=0-199", {
        headers: {
          "Session-Token": sessionToken,
        },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Failed to fetch users:", error.response?.data || error.message);
      if (error.response?.status === 401) {
        this.sessionToken = null;
        return this.getUsers();
      }
      throw error;
    }
  }

  async getGroups(): Promise<any[]> {
    const sessionToken = await this.ensureSession();
    
    try {
      const response = await this.client.get("/Group/?range=0-99", {
        headers: {
          "Session-Token": sessionToken,
        },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.error("Failed to fetch groups:", error.response?.data || error.message);
      if (error.response?.status === 401) {
        this.sessionToken = null;
        return this.getGroups();
      }
      throw error;
    }
  }
}

// Singleton instance
let glpiClient: GlpiClient | null = null;

export function getGlpiClient(): GlpiClient {
  if (!glpiClient) {
    const apiUrl = process.env.GLPI_API_URL;
    const userToken = process.env.GLPI_USER_TOKEN;
    const appToken = process.env.GLPI_APP_TOKEN;

    if (!apiUrl || !userToken || !appToken) {
      throw new Error(
        "Missing GLPI configuration. Please set GLPI_API_URL, GLPI_USER_TOKEN, and GLPI_APP_TOKEN environment variables."
      );
    }

    glpiClient = new GlpiClient({
      apiUrl,
      userToken,
      appToken,
    });
  }

  return glpiClient;
}
