import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User, Bell, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface AccountSettingsProps {
  onBack: () => void;
  playerName: string;
}

export function AccountSettings({ onBack, playerName }: AccountSettingsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleDeleteAccount = () => {
    if (deleteConfirmation === 'DELETE MY ACCOUNT') {
      // Handle account deletion
      console.log('Account deleted');
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#121212] flex flex-col p-6 gap-6" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            className="text-white hover:text-green-500 hover:bg-neutral-800 mb-2"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Lobby
          </Button>
          <h1 className="text-4xl font-bold text-white">Account Settings</h1>
          <p className="text-neutral-400 mt-1">Manage your profile and preferences</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto">
        {/* Profile Settings */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Profile</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-neutral-300">Username</Label>
                <Input
                  id="username"
                  defaultValue={playerName}
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-neutral-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue="player@chess.com"
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="rating" className="text-neutral-300">Current Rating</Label>
                <Input
                  id="rating"
                  value="1650"
                  disabled
                  className="mt-2 bg-neutral-800/50 border-neutral-700 text-neutral-400"
                />
              </div>

              <Button className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800">
                Save Changes
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Game Preferences */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Preferences</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Sound Effects</p>
                  <p className="text-sm text-neutral-400">Play wooden piece sounds</p>
                </div>
                <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
              </div>

              <Separator className="bg-neutral-800" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Voice Announcements</p>
                  <p className="text-sm text-neutral-400">Announce checks and game events</p>
                </div>
                <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
              </div>

              <Separator className="bg-neutral-800" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Notifications</p>
                  <p className="text-sm text-neutral-400">Get notified about challenges</p>
                </div>
                <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
              </div>

              <Separator className="bg-neutral-800" />

              <div>
                <Label htmlFor="timeControl" className="text-neutral-300">Default Time Control</Label>
                <select
                  id="timeControl"
                  className="w-full mt-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white"
                >
                  <option value="300">5 minutes</option>
                  <option value="600" selected>10 minutes</option>
                  <option value="900">15 minutes</option>
                  <option value="1800">30 minutes</option>
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Privacy & Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Privacy & Security</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-neutral-300">Change Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="New password"
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-neutral-300">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  className="mt-2 bg-neutral-800 border-neutral-700 text-white"
                />
              </div>

              <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800">
                Update Password
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-red-950/40 to-red-900/40 backdrop-blur-xl border-red-500/50 p-6 ring-2 ring-red-500/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-red-500">Danger Zone</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300 text-sm mb-3">
                  <strong>Warning:</strong> Deleting your account is permanent and cannot be undone.
                  All your game history, stats, and progress will be lost forever.
                </p>
                <ul className="text-red-400 text-xs space-y-1 ml-4 list-disc">
                  <li>All game history will be deleted</li>
                  <li>Your rating and stats will be lost</li>
                  <li>Friend connections will be removed</li>
                  <li>This action cannot be reversed</li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full border-red-500/50 text-red-500 hover:bg-red-500/20 hover:border-red-500"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-neutral-900 border-red-500/50 ring-2 ring-red-500/20">
          <DialogHeader>
            <DialogTitle className="text-2xl text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Delete Account Permanently
            </DialogTitle>
            <DialogDescription className="text-neutral-300 mt-4 space-y-3">
              <p className="text-base">
                This action is <strong className="text-red-500">irreversible</strong>.
                All your data will be permanently deleted.
              </p>
              <p className="text-sm">
                To confirm deletion, please type <strong className="text-red-500 font-mono">DELETE MY ACCOUNT</strong> below:
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="my-4">
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE MY ACCOUNT"
              className="bg-neutral-800 border-red-500/50 text-white font-mono"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE MY ACCOUNT'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
