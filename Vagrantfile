# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  # All Vagrant configuration is done here. The most common configuration
  # options are documented and commented below. For a complete reference,
  # please see the online documentation at vagrantup.com.

  config.vm.box = "cerberus"
  config.vm.box_url = "http://cgraham.co.uk/boxes/cerberus.box"

  config.vm.network "forwarded_port", guest: 80, host: 1234
  config.vm.network "forwarded_port", guest: 8000, host: 8000
  config.vm.network "forwarded_port", guest: 9200, host: 9200

  # config.vm.network "private_network", ip: "192.168.33.10"

  config.vm.network "public_network"

  # If true, then any SSH connections made will enable agent forwarding.
  # Default value: false
  # config.ssh.forward_agent = true

  config.vm.synced_folder ".", "/vagrant", nfs: true

  config.vm.provider "virtualbox" do |v|
    v.memory = 1536
  end
end
